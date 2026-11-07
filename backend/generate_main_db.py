import sqlite3
import random
from datetime import datetime, timedelta

def generate_main_db():
    conn = sqlite3.connect('crowdfloat.db')
    cursor = conn.cursor()

    cursor.execute('DROP TABLE IF EXISTS users')
    cursor.execute('DROP TABLE IF EXISTS invoices')

    # Create Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            role TEXT,
            name TEXT,
            email TEXT
        )
    ''')

    # Create Invoices table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            supplier_id TEXT,
            supplier_name TEXT,
            buyer_id TEXT,
            buyer_name TEXT,
            buyer_email TEXT,
            program TEXT,
            po_reference TEXT,
            due_date TEXT,
            amount REAL,
            status TEXT,
            dispute_reason TEXT,
            gst_verified INTEGER,
            gst_number TEXT,
            gst_company_name TEXT,
            trust_score REAL,
            risk_level TEXT,
            scraped_invoice_id TEXT
        )
    ''')

    # Add dummy users
    buyers = [
        ('buyer-aurora', 'buyer', 'Aurora Retail Pvt Ltd', 'ap@auroraretail.com'),
        ('buyer-nova', 'buyer', 'Nova Trade Hub', 'finance@novatradehub.com'),
        ('buyer-summit', 'buyer', 'Summit Procurement Ltd', 'payables@summitprocure.com')
    ]
    companies = [
        ('comp-acme', 'company', 'Acme Trading Co', 'acme@example.com'),
        ('comp-zenith', 'company', 'Zenith Logistics', 'zenith@example.com'),
        ('comp-apex', 'company', 'Apex Manufacturing', 'apex@example.com')
    ]
    funders = [
        ('funder-alpha', 'funder', 'Alpha Capital Partners', 'alpha@example.com'),
        ('funder-beta', 'funder', 'Beta Yield Fund', 'beta@example.com')
    ]

    cursor.execute('DELETE FROM users')
    for u in buyers + companies + funders:
        cursor.execute('INSERT INTO users VALUES (?, ?, ?, ?)', u)

    # Generate dummy invoices
    cursor.execute('DELETE FROM invoices')
    statuses = [
        'awaiting-buyer-confirmation',     # Buyer dashboard needs these
        'confirmed-financing-eligible',    # Funder dashboard needs these
        'disputed'
    ]
    programs = ['SCF Core', 'Distributor Plus', 'Strategic Vendors']
    risk_levels = ['Low', 'Medium', 'High']

    for i in range(1, 35): # create ~35 invoices
        comp = random.choice(companies)
        buyer = random.choice(buyers)
        
        status = random.choices(statuses, weights=[0.2, 0.7, 0.1])[0]
        amount = round(random.uniform(10_000, 500_000), 2)
        
        # 14 to 90 days from now
        due_date = (datetime.now() + timedelta(days=random.randint(14, 90))).strftime('%Y-%m-%d')
        
        trust_score = random.uniform(0.65, 0.99)
        risk = 'Low' if trust_score > 0.85 else ('Medium' if trust_score > 0.75 else 'High')

        invoice_id = f"CF-INV-{random.randint(1000, 9999)}-{i}"
        
        cursor.execute('''
            INSERT INTO invoices (
                id, supplier_id, supplier_name, buyer_id, buyer_name, buyer_email,
                program, po_reference, due_date, amount, status, dispute_reason,
                gst_verified, gst_number, gst_company_name, trust_score, risk_level, scraped_invoice_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            invoice_id,
            comp[0],
            comp[2],
            buyer[0],
            buyer[2],
            buyer[3],
            random.choice(programs),
            f"PO-{random.randint(10000, 99999)}",
            due_date,
            amount,
            status,
            "Price mismatch" if status == 'disputed' else "",
            1 if random.random() > 0.1 else 0, # 90% chance gst_verified = true
            f"27{random.randint(100000000, 999999999)}Z",
            comp[2],
            trust_score,
            risk,
            f"EXT-{random.randint(100, 999)}"
        ))

    conn.commit()
    conn.close()
    print("Main crowdfloat.db generated successfully with users and ~35 invoices.")

if __name__ == '__main__':
    generate_main_db()
