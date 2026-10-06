import numpy as np
import pandas as pd
import pytest

from app.data.schema import CANONICAL_COLUMNS_MAPPING
from app.preprocessing.label_normalizer import normalize_label, RAW_TO_NORMALIZED_MAPPING
from app.data.ingestion import clean_dataframe


def test_label_normalizer_mappings():
    # Verify standard mappings
    assert normalize_label("BENIGN") == "BENIGN"
    assert normalize_label("DDoS") == "DDoS"
    assert normalize_label("PortScan") == "PortScan"
    assert normalize_label("DoS Hulk") == "DoS"
    assert normalize_label("DoS GoldenEye") == "DoS"
    assert normalize_label("FTP-Patator") == "BruteForce"
    assert normalize_label("SSH-Patator") == "BruteForce"
    assert normalize_label("Bot") == "Botnet"
    assert normalize_label("Infiltration") == "Infiltration"
    assert normalize_label("Heartbleed") == "Heartbleed"


def test_label_normalizer_encoding_robustness():
    # Test encoding oddities
    assert normalize_label("Web Attack \ufffd Brute Force") == "WebAttack"
    assert normalize_label("Web Attack – XSS") == "WebAttack"
    assert normalize_label("Web Attack - Sql Injection") == "WebAttack"


def test_clean_dataframe_inf_and_nan_removal():
    dirty_data = {
        " Destination Port": [80, 443, 22, 8080, 53],
        " Flow Duration": [100.0, np.inf, 200.0, -np.inf, 300.0],
        " Total Fwd Packets": [2, 3, np.nan, 5, 2],
        " Label": ["BENIGN", "DDoS", "PortScan", "BENIGN", "BENIGN"],
    }
    df = pd.DataFrame(dirty_data)
    clean_df, stats = clean_dataframe(df, "test.csv")

    assert stats["rows_before"] == 5
    assert stats["inf_rows_removed"] == 2
    assert stats["nan_rows_removed"] == 1
    assert stats["rows_final"] == 2
    assert not np.isinf(clean_df["flow_duration"].values).any()
    assert not clean_df.isna().values.any()
    assert clean_df["label"].tolist() == ["BENIGN", "BENIGN"]
