"""
NetSentry AI — Controlled Network Flow Replay Engine (Phase 2)
==============================================================

Academic & Ethical Notice:
This module is a strictly controlled benchmark dataset replay engine.
It does NOT generate, craft, or launch real cyberattacks, nor does it send
packets across the external internet or production network interfaces.
It systematically samples authentic, pre-cleansed network flow vectors from the
CIC-IDS2017 research dataset (clean_flows.parquet) and transmits them across a
local Redis stream for low-latency ML inference evaluation.

Modes:
- NORMAL: Replays purely BENIGN baseline network flows.
- ATTACK: Replays known attack vectors (DDoS, PortScan, DoS, BruteForce, etc.).
- MIXED: Replays an interleaved, randomized combination of benign and threat traffic.
"""

import argparse
import json
import logging
import os
import random
import sys
import time
import uuid
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import redis

from app.streaming.config import STREAMING_CONFIG

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NetSentryReplay")

DATASET_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "processed" / "clean_flows.parquet"


class FlowReplayEngine:
    def __init__(
        self,
        dataset_path: Path = DATASET_PATH,
        config=STREAMING_CONFIG,
    ):
        self.dataset_path = dataset_path
        self.config = config
        self.redis_client = redis.Redis(
            host=self.config.redis_host,
            port=self.config.redis_port,
            password=self.config.redis_password or None,
            db=self.config.redis_db,
            decode_responses=True,
        )
        self.df: Optional[pd.DataFrame] = None
        self.benign_df: Optional[pd.DataFrame] = None
        self.attack_df: Optional[pd.DataFrame] = None
        self.evaluation_map: Dict[str, str] = {}

    def load_dataset(self):
        if not self.dataset_path.exists():
            raise FileNotFoundError(f"Cleaned dataset not found at {self.dataset_path}")

        logger.info(f"Loading replay dataset from {self.dataset_path}...")
        self.df = pd.read_parquet(self.dataset_path)
        logger.info(f"Loaded {len(self.df):,} total flows across {len(self.df.columns)} columns.")

        self.benign_df = self.df[self.df["label"] == "BENIGN"].reset_index(drop=True)
        self.attack_df = self.df[self.df["label"] != "BENIGN"].reset_index(drop=True)
        logger.info(
            f"Dataset partitioned: {len(self.benign_df):,} BENIGN flows, "
            f"{len(self.attack_df):,} ATTACK flows."
        )

    def select_samples(
        self,
        mode: str = "MIXED",
        count: Optional[int] = None,
        attack_category: Optional[str] = None,
    ) -> pd.DataFrame:
        if self.df is None:
            self.load_dataset()

        mode_upper = mode.upper()
        if mode_upper == "NORMAL":
            pool = self.benign_df
        elif mode_upper == "ATTACK":
            if attack_category:
                pool = self.attack_df[self.attack_df["label"].str.upper() == attack_category.upper()]
                if pool.empty:
                    available = self.attack_df["label"].unique().tolist()
                    raise ValueError(f"No samples for '{attack_category}'. Available: {available}")
            else:
                pool = self.attack_df
        elif mode_upper == "MIXED":
            pool = self.df
        else:
            raise ValueError(f"Unknown mode '{mode}'. Choose from NORMAL, ATTACK, MIXED.")

        if count is None or count >= len(pool):
            return pool.sample(frac=1.0).reset_index(drop=True)
        return pool.sample(n=count).reset_index(drop=True)

    @staticmethod
    def _synthesize_network_flow(row: pd.Series, flow_id: str, timestamp_str: str) -> dict:
        """
        Synthesizes standard NetworkFlow metadata (IPs, ports, flags) to accompany
        the 77 statistical features for end-to-end downstream Core API persistence.
        """
        dest_port = int(row.get("destination_port", 80))
        is_attack = row.get("label", "BENIGN") != "BENIGN"

        # Deterministic simulation IPs based on traffic profile
        if is_attack:
            src_ip = f"172.16.0.{random.randint(2, 250)}"
        else:
            src_ip = f"192.168.10.{random.randint(10, 100)}"

        dest_ip = "192.168.10.50"  # Enterprise server victim/service
        src_port = random.randint(32768, 61000)
        protocol = "TCP" if dest_port not in (53, 67, 68, 123) else "UDP"

        return {
            "id": flow_id,
            "timestamp": timestamp_str,
            "sourceIp": src_ip,
            "destinationIp": dest_ip,
            "sourcePort": src_port,
            "destinationPort": dest_port,
            "protocol": protocol,
            "durationMs": float(row.get("flow_duration", 0)) / 1000.0,
            "totalFwdPackets": int(row.get("total_fwd_packets", 1)),
            "totalBwdPackets": int(row.get("total_bwd_packets", 0)),
            "totalFwdBytes": float(row.get("total_fwd_bytes", 0.0)),
            "totalBwdBytes": float(row.get("total_bwd_bytes", 0.0)),
            "fwdPacketLengthMean": float(row.get("fwd_packet_length_mean", 0.0)),
            "bwdPacketLengthMean": float(row.get("bwd_packet_length_mean", 0.0)),
            "flowBytesPerSec": float(row.get("flow_bytes_per_sec", 0.0)),
            "flowPacketsPerSec": float(row.get("flow_packets_per_sec", 0.0)),
            "synFlagCount": int(row.get("syn_flag_count", 0)),
            "finFlagCount": int(row.get("fin_flag_count", 0)),
            "rstFlagCount": int(row.get("rst_flag_count", 0)),
            "pshFlagCount": int(row.get("psh_flag_count", 0)),
            "ackFlagCount": int(row.get("ack_flag_count", 0)),
        }

    def replay(
        self,
        mode: str = "MIXED",
        flows_per_second: float = 50.0,
        max_events: Optional[int] = None,
        batch_size: int = 1,
        compute_shap: bool = True,
        attack_category: Optional[str] = None,
    ) -> Dict[str, any]:
        """
        Executes controlled flow replay into Redis stream 'netsentry:flows'.
        """
        samples = self.select_samples(mode=mode, count=max_events, attack_category=attack_category)
        total_samples = len(samples)
        logger.info(
            f"Starting replay: Mode={mode.upper()}, Rate={flows_per_second} flows/s, "
            f"BatchSize={batch_size}, TotalTarget={total_samples}, SHAP={compute_shap}"
        )

        published_count = 0
        t_start = time.perf_counter()
        target_interval = batch_size / max(flows_per_second, 0.1)

        feature_cols = [c for c in samples.columns if c != "label"]

        batch_items = []
        for idx, row in samples.iterrows():
            flow_id = f"flow-{uuid.uuid4().hex[:12]}"
            timestamp_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            # 77 feature dictionary strictly devoid of ground-truth label
            features_dict = {col: float(row[col]) for col in feature_cols}
            # Evaluation correlation strictly stored in local map, never published to model input stream
            self.evaluation_map[flow_id] = str(row["label"])
            flow_meta = self._synthesize_network_flow(row, flow_id, timestamp_str)

            message_payload = {
                "flow_id": flow_id,
                "timestamp": timestamp_str,
                "features": json.dumps(features_dict),
                "flow": json.dumps(flow_meta),
                "compute_shap": "true" if compute_shap else "false",
                "source": "replay",
            }
            batch_items.append(message_payload)

            if len(batch_items) >= batch_size:
                pipeline = self.redis_client.pipeline()
                for item in batch_items:
                    pipeline.xadd(self.config.stream_flows, item)
                pipeline.execute()

                published_count += len(batch_items)
                batch_items = []

                # Rate control sleep
                time.sleep(target_interval)

            if max_events and published_count >= max_events:
                break

        # Flush any remaining items in last batch
        if batch_items:
            pipeline = self.redis_client.pipeline()
            for item in batch_items:
                pipeline.xadd(self.config.stream_flows, item)
            pipeline.execute()
            published_count += len(batch_items)

        total_elapsed = time.perf_counter() - t_start
        actual_rate = published_count / max(total_elapsed, 0.001)

        stats = {
            "mode": mode.upper(),
            "target_rate_fps": flows_per_second,
            "actual_rate_fps": round(actual_rate, 2),
            "published_events": published_count,
            "elapsed_seconds": round(total_elapsed, 3),
            "stream_key": self.config.stream_flows,
        }
        logger.info(f"Replay complete: {stats}")
        return stats


def main():
    parser = argparse.ArgumentParser(description="NetSentry AI Controlled Flow Replay Engine")
    parser.add_argument("--mode", type=str, default="MIXED", choices=["NORMAL", "ATTACK", "MIXED"], help="Replay mode")
    parser.add_argument("--rate", type=float, default=20.0, help="Target flows per second")
    parser.add_argument("--max", type=int, default=100, help="Maximum events to publish")
    parser.add_argument("--batch-size", type=int, default=5, help="Batch size per Redis pipeline")
    parser.add_argument("--no-shap", action="store_true", help="Disable SHAP explanation for high-speed benchmark")
    parser.add_argument("--attack", type=str, default=None, help="Specific attack class filter (e.g. DDoS, PortScan)")
    args = parser.parse_args()

    engine = FlowReplayEngine()
    engine.replay(
        mode=args.mode,
        flows_per_second=args.rate,
        max_events=args.max,
        batch_size=args.batch_size,
        compute_shap=not args.no_shap,
        attack_category=args.attack,
    )


if __name__ == "__main__":
    main()
