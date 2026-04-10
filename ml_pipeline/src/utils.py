import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os


def load_ai4i(path="data/raw/ai4i2020.csv"):
    df = pd.read_csv(path)
    return df


def save_figure(fig, name, folder="outputs/figures"):
    os.makedirs(folder, exist_ok=True)
    fig.savefig(f"{folder}/{name}.png", dpi=150, bbox_inches='tight')
    print(f"Figure saved: {folder}/{name}.png")
