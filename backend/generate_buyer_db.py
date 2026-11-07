import sqlite3
import random
import os

DB_PATH = 'buyer_financials.db'

def generate_buyer_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Create table for buyer financials
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS buyer_financials (
            buyer_id TEXT PRIMARY KEY,
            buyer_name TEXT,
            on_time_ratio REAL,
            avg_delay_days REAL,
            late_payment_ratio REAL,
            total_transactions INTEGER,
            payment_trend REAL,
            credit_score INTEGER,
            debt_to_income_ratio REAL,
            avg_invoice_value REAL
        )
    ''')

    # Specific buyers from the App (must match REGISTERED_BUYERS in crowdfloat-react/src/App.jsx)
    hardcoded_buyers = [
        {"id": "buyer-aurora", "name": "Aurora Retail Pvt Ltd"},
        {"id": "buyer-nova",   "name": "Nova Trade Hub"},
        {"id": "buyer-summit", "name": "Summit Procurement Ltd"},
    ]

    records = []

    # Helper to generate realistic dummy stats
    def generate_stats(is_good=True):
        if is_good:
            return (
                round(random.uniform(0.80, 0.99), 2),  # on_time_ratio
                round(random.uniform(1.0, 15.0), 1),   # avg_delay_days
                round(random.uniform(0.01, 0.20), 2),  # late_payment_ratio
                random.randint(50, 1000),              # total_transactions
                round(random.uniform(0.6, 1.0), 2),    # payment_trend
                random.randint(700, 850),              # credit_score
                round(random.uniform(0.1, 0.4), 2),    # debt_to_income_ratio
                round(random.uniform(20000, 500000), 2) # avg_invoice_value
            )
        else:
            return (
                round(random.uniform(0.40, 0.79), 2),  # on_time_ratio
                round(random.uniform(16.0, 90.0), 1),  # avg_delay_days
                round(random.uniform(0.21, 0.60), 2),  # late_payment_ratio
                random.randint(10, 200),               # total_transactions
                round(random.uniform(0.1, 0.5), 2),    # payment_trend
                random.randint(400, 650),              # credit_score
                round(random.uniform(0.41, 0.9), 2),   # debt_to_income_ratio
                round(random.uniform(5000, 100000), 2) # avg_invoice_value
            )

    # Insert hardcoded buyers — Aurora good, Nova medium/bad, Summit good
    records.append((hardcoded_buyers[0]["id"], hardcoded_buyers[0]["name"]) + generate_stats(is_good=True))
    records.append((hardcoded_buyers[1]["id"], hardcoded_buyers[1]["name"]) + generate_stats(is_good=False))
    records.append((hardcoded_buyers[2]["id"], hardcoded_buyers[2]["name"]) + generate_stats(is_good=True))

    # Generate additional 497 dummy buyers
    for i in range(4, 501):
        buyer_id = f"buyer-{i}"
        buyer_name = f"Dummy Company {i} Ltd."
        is_good = random.random() > 0.3 # 70% good, 30% bad
        records.append((buyer_id, buyer_name) + generate_stats(is_good=is_good))

    cursor.executemany('''
        INSERT INTO buyer_financials (
            buyer_id, buyer_name, on_time_ratio, avg_delay_days, 
            late_payment_ratio, total_transactions, payment_trend, 
            credit_score, debt_to_income_ratio, avg_invoice_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', records)

    conn.commit()
    conn.close()
    
    print(f"Successfully generated database '{DB_PATH}' with {len(records)} records.")

if __name__ == "__main__":
    generate_buyer_db()
