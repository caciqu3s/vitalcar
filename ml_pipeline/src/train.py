from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from xgboost import XGBClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
import joblib
import json
import os


def get_models():
    """Returns dict of all models to compare"""
    return {
        'Baseline (Logistic Regression)': LogisticRegression(
            class_weight='balanced', max_iter=1000, random_state=42
        ),
        'Random Forest': RandomForestClassifier(
            n_estimators=200,
            class_weight='balanced',
            random_state=42,
            n_jobs=-1
        ),
        'XGBoost': XGBClassifier(
            n_estimators=200,
            scale_pos_weight=30,  # compensates class imbalance
            random_state=42,
            eval_metric='logloss',
            verbosity=0
        ),
        'SVM': SVC(
            kernel='rbf',
            class_weight='balanced',
            probability=True,
            random_state=42
        )
    }


def train_all(models, X_train, y_train):
    """Trains all models and returns dict of trained models"""
    os.makedirs('outputs/models', exist_ok=True)
    trained = {}
    for name, model in models.items():
        print(f"Training: {name}...")
        model.fit(X_train, y_train)
        trained[name] = model
        safe_name = name.replace(' ', '_').replace('(', '').replace(')', '')
        joblib.dump(model, f'outputs/models/{safe_name}.pkl')
    return trained


def cross_validate_all(models, X_train, y_train, cv=5):
    """Stratified k-fold cross-validation for all models"""
    os.makedirs('outputs/reports', exist_ok=True)
    cv_results = {}
    skf = StratifiedKFold(n_splits=cv, shuffle=True, random_state=42)

    for name, model in models.items():
        scores = cross_val_score(model, X_train, y_train, cv=skf, scoring='f1', n_jobs=-1)
        cv_results[name] = {
            'f1_mean': scores.mean(),
            'f1_std': scores.std(),
            'scores': scores.tolist()
        }
        print(f"{name}: F1 = {scores.mean():.4f} ± {scores.std():.4f}")

    with open('outputs/reports/cv_results.json', 'w') as f:
        json.dump(cv_results, f, indent=2)

    return cv_results
