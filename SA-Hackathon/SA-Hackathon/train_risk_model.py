import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import lightgbm as lgb
import joblib

df = pd.read_csv(r"C:\Users\Lenovo\Downloads\synthetic_risk_dataset_50k.csv")

# Handle missing values
df = df.dropna()

# Load separate dataset for buyer risk model
df_buyer = pd.read_csv(r"C:\Users\Lenovo\Downloads\synthetic_buyer_risk_50k.csv")
df_buyer = df_buyer.dropna()

print("Buyer dataset columns:", df_buyer.columns.tolist())

buyer_features = [
    "on_time_ratio","avg_delay_days","late_payment_ratio",
    "total_transactions","avg_invoice_value",
    "credit_score","debt_to_income_ratio","payment_trend"
]

X = df_buyer[buyer_features]
y = df_buyer["buyer_risk_label"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = lgb.LGBMClassifier()
model.fit(X_train, y_train)

# Save the model
joblib.dump(model, 'buyer_risk_model.pkl')

print("Buyer Risk Model Feature Importances:")
importances = model.feature_importances_
for feat, imp in zip(buyer_features, importances):
    print(f"{feat}: {imp}")

preds = model.predict_proba(X_test)[:,1]
print(roc_auc_score(y_test, preds))
seller_features = [
    "dispute_rate","rejection_rate","seller_avg_invoice_value",
    "invoice_deviation","invoice_growth_rate",
    "gst_filing_consistency","past_fraud_flag"
]

X = df[seller_features]
y = df["seller_fraud_label"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model2 = lgb.LGBMClassifier()
model2.fit(X_train, y_train)

print("Seller Fraud Model Feature Importances:")
importances2 = model2.feature_importances_
for feat, imp in zip(seller_features, importances2):
    print(f"{feat}: {imp}")

preds = model2.predict_proba(X_test)[:,1]
print(roc_auc_score(y_test, preds))