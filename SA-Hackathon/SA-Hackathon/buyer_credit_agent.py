import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import lightgbm as lgb
import joblib

class CreditworthinessAgentPipeline:
    """
    Agent Pipeline for Buyer Creditworthiness Assessment

    Roles:
    1. DataProcessor: Processes raw inputs (payment history, credit ratings, financial statement)
    2. FeatureExtractor: Extracts relevant features from processed data
    3. ModelPredictor: Uses trained model to predict risk probability
    4. ScoreCalculator: Converts risk probability to creditworthiness score

    Inputs:
    - payment_history: dict or DataFrame with payment data
    - credit_ratings: dict with credit score and ratings
    - financial_statement: dict or DataFrame with financial metrics

    Output:
    - creditworthiness_score: float between 0-1000 (higher = more creditworthy)
    """

    def __init__(self, model_path='buyer_risk_model.pkl'):
        self.scaler = StandardScaler()
        try:
            self.model = joblib.load(model_path)
        except:
            print("Model not found, using dummy prediction")
            self.model = None
        self.feature_columns = [
            "on_time_ratio", "avg_delay_days", "late_payment_ratio",
            "total_transactions", "avg_invoice_value",
            "credit_score", "debt_to_income_ratio", "payment_trend"
        ]

    def process_data(self, payment_history, credit_ratings, financial_statement):
        """
        Role: DataProcessor
        Processes raw inputs into structured format
        """
        processed_data = {}

        # Process payment history
        if isinstance(payment_history, dict):
            processed_data.update(payment_history)
        elif isinstance(payment_history, pd.DataFrame):
            # Calculate aggregates
            processed_data['on_time_ratio'] = payment_history['on_time_payments'].sum() / len(payment_history)
            processed_data['avg_delay_days'] = payment_history['delay_days'].mean()
            processed_data['late_payment_ratio'] = payment_history['late_payments'].sum() / len(payment_history)
            processed_data['total_transactions'] = len(payment_history)
            processed_data['payment_trend'] = self._calculate_payment_trend(payment_history)

        # Process credit ratings
        if isinstance(credit_ratings, dict):
            processed_data['credit_score'] = credit_ratings.get('credit_score', 0)
            # Add other ratings if available

        # Process financial statement
        if isinstance(financial_statement, dict):
            processed_data['debt_to_income_ratio'] = financial_statement.get('debt_to_income_ratio', 0)
            processed_data['avg_invoice_value'] = financial_statement.get('avg_invoice_value', 0)
            # Add other financial metrics

        return processed_data

    def extract_features(self, processed_data):
        """
        Role: FeatureExtractor
        Extracts and engineers features for model input
        """
        features = {}
        for col in self.feature_columns:
            features[col] = processed_data.get(col, 0)

        # Feature engineering
        features['risk_score'] = (
            features['avg_delay_days'] * 0.3 +
            features['late_payment_ratio'] * 0.4 +
            (1000 - features['credit_score']) * 0.3
        )

        return pd.DataFrame([features])

    def predict_risk(self, features_df):
        """
        Role: ModelPredictor
        Uses trained model to predict risk probability
        """
        if self.model is not None:
            risk_prob = self.model.predict_proba(features_df[self.feature_columns])[:, 1][0]
        else:
            # Fallback to dummy prediction
            risk_prob = self._dummy_risk_prediction(features_df)

        return risk_prob

    def calculate_score(self, risk_probability):
        """
        Role: ScoreCalculator
        Converts risk probability to creditworthiness score (0-1000)
        """
        # Higher score = more creditworthy (less risky)
        creditworthiness_score = (1 - risk_probability) * 1000
        return round(creditworthiness_score, 2)

    def run_pipeline(self, payment_history, credit_ratings, financial_statement):
        """
        Complete pipeline execution
        """
        # Step 1: Process data
        processed = self.process_data(payment_history, credit_ratings, financial_statement)

        # Step 2: Extract features
        features = self.extract_features(processed)

        # Step 3: Predict risk
        risk_prob = self.predict_risk(features)

        # Step 4: Calculate score
        score = self.calculate_score(risk_prob)

        return {
            'creditworthiness_score': score,
            'risk_probability': risk_prob,
            'processed_data': processed,
            'features': features.to_dict('records')[0]
        }

    def _calculate_payment_trend(self, payment_df):
        """
        Helper: Calculate payment trend (simplified)
        """
        if len(payment_df) < 2:
            return 0
        recent_delays = payment_df['delay_days'].tail(5).mean()
        overall_delays = payment_df['delay_days'].mean()
        return max(0, 1 - (recent_delays / overall_delays if overall_delays > 0 else 0))

    def _dummy_risk_prediction(self, features_df):
        """
        Dummy prediction for demo when no model is loaded
        """
        # Simple rule-based prediction
        risk_factors = (
            features_df['avg_delay_days'].iloc[0] * 0.2 +
            features_df['late_payment_ratio'].iloc[0] * 0.3 +
            features_df['debt_to_income_ratio'].iloc[0] * 0.2 +
            (1000 - features_df['credit_score'].iloc[0]) * 0.3
        )
        risk_prob = min(1.0, risk_factors / 100)  # Normalize
        return risk_prob

# Example usage
if __name__ == "__main__":
    # Initialize pipeline
    agent = CreditworthinessAgentPipeline()

    # Sample inputs
    payment_history = {
        'on_time_ratio': 0.85,
        'avg_delay_days': 5.2,
        'late_payment_ratio': 0.15,
        'total_transactions': 150,
        'payment_trend': 0.8
    }

    credit_ratings = {
        'credit_score': 750
    }

    financial_statement = {
        'debt_to_income_ratio': 0.35,
        'avg_invoice_value': 5000
    }

    # Run pipeline
    result = agent.run_pipeline(payment_history, credit_ratings, financial_statement)

    print("Buyer Creditworthiness Assessment Results:")
    print(f"Creditworthiness Score: {result['creditworthiness_score']}/1000")
    print(f"Risk Probability: {result['risk_probability']:.3f}")
    print(f"Features Used: {result['features']}")