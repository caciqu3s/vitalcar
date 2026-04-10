from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, roc_curve,
    f1_score, accuracy_score
)
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
import shap
import json
import os


def evaluate_all(trained_models, X_test, y_test):
    """Evaluates all models on the held-out test set"""
    os.makedirs('outputs/reports', exist_ok=True)
    results = {}

    for name, model in trained_models.items():
        y_pred = model.predict(X_test)
        y_prob = model.predict_proba(X_test)[:, 1]

        results[name] = {
            'accuracy': accuracy_score(y_test, y_pred),
            'f1': f1_score(y_test, y_pred),
            'roc_auc': roc_auc_score(y_test, y_prob),
            'report': classification_report(y_test, y_pred, output_dict=True)
        }

        print(f"\n{'='*50}")
        print(f"MODEL: {name}")
        print(f"Accuracy : {results[name]['accuracy']:.4f}")
        print(f"F1-Score : {results[name]['f1']:.4f}")
        print(f"ROC-AUC  : {results[name]['roc_auc']:.4f}")
        print(classification_report(y_test, y_pred, target_names=['Normal', 'Failure']))

    with open('outputs/reports/test_results.json', 'w') as f:
        json.dump({k: {m: v for m, v in r.items() if m != 'report'}
                   for k, r in results.items()}, f, indent=2)

    return results


def plot_confusion_matrices(trained_models, X_test, y_test):
    """Generates confusion matrix for each model"""
    os.makedirs('outputs/figures', exist_ok=True)
    n = len(trained_models)
    fig, axes = plt.subplots(1, n, figsize=(5 * n, 4))
    if n == 1:
        axes = [axes]

    for ax, (name, model) in zip(axes, trained_models.items()):
        y_pred = model.predict(X_test)
        cm = confusion_matrix(y_test, y_pred)
        sns.heatmap(cm, annot=True, fmt='d', ax=ax, cmap='Blues',
                    xticklabels=['Normal', 'Failure'],
                    yticklabels=['Normal', 'Failure'])
        ax.set_title(name, fontsize=10)
        ax.set_ylabel('Actual')
        ax.set_xlabel('Predicted')

    plt.tight_layout()
    plt.savefig('outputs/figures/confusion_matrices.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Figure saved: outputs/figures/confusion_matrices.png")


def plot_roc_curves(trained_models, X_test, y_test):
    """Comparative ROC curves for all models"""
    os.makedirs('outputs/figures', exist_ok=True)
    plt.figure(figsize=(8, 6))

    for name, model in trained_models.items():
        y_prob = model.predict_proba(X_test)[:, 1]
        fpr, tpr, _ = roc_curve(y_test, y_prob)
        auc = roc_auc_score(y_test, y_prob)
        plt.plot(fpr, tpr, label=f"{name} (AUC={auc:.3f})")

    plt.plot([0, 1], [0, 1], 'k--', label='Random')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('ROC Curves — Model Comparison')
    plt.legend()
    plt.tight_layout()
    plt.savefig('outputs/figures/roc_curves.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Figure saved: outputs/figures/roc_curves.png")


def plot_feature_importance(rf_model, feature_names):
    """Feature importance from Random Forest"""
    os.makedirs('outputs/figures', exist_ok=True)
    importances = pd.Series(rf_model.feature_importances_, index=feature_names)
    importances = importances.sort_values(ascending=True)

    fig, ax = plt.subplots(figsize=(8, 6))
    importances.plot(kind='barh', ax=ax, color='steelblue')
    ax.set_title('Feature Importance — Random Forest')
    ax.set_xlabel('Relative Importance')
    plt.tight_layout()
    plt.savefig('outputs/figures/feature_importance.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Figure saved: outputs/figures/feature_importance.png")


def plot_shap_values(rf_model, X_test_df, feature_names):
    """Model explainability with SHAP (XAI)"""
    os.makedirs('outputs/figures', exist_ok=True)
    explainer = shap.TreeExplainer(rf_model)

    # Use the new Explanation-based API (shap >= 0.46)
    explanation = explainer(X_test_df)

    # For a binary classifier the Explanation has shape (n_samples, n_features, 2).
    # Index [... , 1] selects the positive (failure) class.
    if explanation.values.ndim == 3:
        explanation_failure = explanation[..., 1]
    else:
        explanation_failure = explanation

    plt.figure()
    shap.plots.beeswarm(explanation_failure, show=False)
    plt.tight_layout()
    plt.savefig('outputs/figures/shap_summary.png', dpi=150, bbox_inches='tight')
    plt.close()
    print("Figure saved: outputs/figures/shap_summary.png")


def plot_comparison_table(results):
    """Final comparison table across all models"""
    os.makedirs('outputs/reports', exist_ok=True)
    rows = []
    for name, metrics in results.items():
        rows.append({
            'Model': name,
            'Accuracy': f"{metrics['accuracy']:.4f}",
            'F1-Score': f"{metrics['f1']:.4f}",
            'ROC-AUC': f"{metrics['roc_auc']:.4f}"
        })
    df = pd.DataFrame(rows)
    df.to_csv('outputs/reports/model_comparison.csv', index=False)
    print("\nComparison table saved to outputs/reports/model_comparison.csv")
    print(df.to_string(index=False))
    return df
