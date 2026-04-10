import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from imblearn.over_sampling import SMOTE
import joblib
import os


def load_and_clean(path):
    df = pd.read_csv(path)

    # Drop non-predictive columns
    drop_cols = ['UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF']
    df = df.drop(columns=drop_cols)

    # Encode Type column (L/M/H) as numeric
    df['Type'] = df['Type'].map({'L': 0, 'M': 1, 'H': 2})

    return df


def feature_engineering(df):
    # Derived feature: temperature differential (analogous to engine thermal delta)
    df['temp_diff'] = df['Process temperature [K]'] - df['Air temperature [K]']

    # Derived feature: estimated power (RPM x Torque)
    df['power_proxy'] = df['Rotational speed [rpm]'] * df['Torque [Nm]']

    return df


def split_and_scale(df, target='Machine failure', test_size=0.2, random_state=42):
    X = df.drop(columns=[target])
    y = df[target]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    os.makedirs('outputs/models', exist_ok=True)
    joblib.dump(scaler, 'outputs/models/scaler.pkl')

    return X_train_scaled, X_test_scaled, y_train, y_test, X.columns.tolist()


def apply_smote(X_train, y_train, random_state=42):
    """Balance minority class (failures are rare)"""
    smote = SMOTE(random_state=random_state)
    X_res, y_res = smote.fit_resample(X_train, y_train)
    print(f"After SMOTE: {pd.Series(y_res).value_counts().to_dict()}")
    return X_res, y_res
