"""
VitalCar — ML Pipeline
Full pipeline: load -> EDA -> preprocessing -> training -> evaluation
Run this first. Output: Random_Forest.pkl and scaler.pkl in outputs/models/
"""

import os
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')  # non-interactive mode

from src.utils import load_ai4i, save_figure
from src.preprocess import load_and_clean, feature_engineering, split_and_scale, apply_smote
from src.train import get_models, train_all, cross_validate_all
from src.evaluate import (evaluate_all, plot_confusion_matrices, plot_roc_curves,
                           plot_feature_importance, plot_shap_values, plot_comparison_table)

os.makedirs('outputs/figures', exist_ok=True)
os.makedirs('outputs/models', exist_ok=True)
os.makedirs('outputs/reports', exist_ok=True)

# --- STEP 1: LOAD & CLEAN ----------------------------------------------------
print("\n[1/6] Loading and cleaning data...")
df = load_and_clean("data/raw/ai4i2020.csv")
print(f"Shape: {df.shape}")
print(f"Failures: {df['Machine failure'].sum()} ({df['Machine failure'].mean()*100:.1f}%)")

# --- STEP 2: FEATURE ENGINEERING --------------------------------------------
print("\n[2/6] Feature engineering...")
df = feature_engineering(df)
print("Derived features created: temp_diff, power_proxy")

# --- STEP 3: SPLIT + SCALING ------------------------------------------------
print("\n[3/6] Train/test split and normalization...")
X_train, X_test, y_train, y_test, feature_names = split_and_scale(df)
print(f"Train: {len(y_train)} samples | Test: {len(y_test)} samples")

# Balance with SMOTE
X_train_bal, y_train_bal = apply_smote(X_train, y_train)

# --- STEP 4: CROSS-VALIDATION -----------------------------------------------
print("\n[4/6] Stratified 5-fold cross-validation...")
models = get_models()
cv_results = cross_validate_all(models, X_train_bal, y_train_bal)

# --- STEP 5: FINAL TRAINING -------------------------------------------------
print("\n[5/6] Final training on balanced data...")
trained_models = train_all(models, X_train_bal, y_train_bal)

# --- STEP 6: TEST SET EVALUATION --------------------------------------------
print("\n[6/6] Evaluating on held-out test set (never seen during training)...")
results = evaluate_all(trained_models, X_test, y_test)

# Generate all charts
plot_confusion_matrices(trained_models, X_test, y_test)
plot_roc_curves(trained_models, X_test, y_test)
plot_feature_importance(trained_models['Random Forest'], feature_names)

# SHAP — explainability (XAI)
X_test_df = pd.DataFrame(X_test, columns=feature_names)
plot_shap_values(trained_models['Random Forest'], X_test_df, feature_names)

# Final comparison table
comparison_df = plot_comparison_table(results)

print("\nPipeline complete! Check the outputs/ folder.")
