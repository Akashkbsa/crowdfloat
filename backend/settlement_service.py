import sqlite3
import datetime
import uuid
import os
from typing import List, Dict, Any

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crowdfloat.db')

def _init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Funding allocations per invoice
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS allocations (
            id TEXT PRIMARY KEY,
            invoice_id TEXT,
            funder_id TEXT,
            allocated_amount REAL,
            created_at TEXT
        )
    ''')
    # Settlements records
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settlements (
            id TEXT PRIMARY KEY,
            invoice_id TEXT,
            participant_id TEXT,
            participant_type TEXT,
            amount_paid REAL,
            settled_at TEXT
        )
    ''')
    conn.commit()
    conn.close()

# Initialize tables on module import
_init_db()

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def register_allocations(invoice_id: str, allocations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Register funding allocations for a given invoice.
    Expected allocations format: [{"funder_id": "funder1", "allocated_amount": 50000}]
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if invoice exists
    cursor.execute("SELECT id, status FROM invoices WHERE id = ?", (invoice_id,))
    inv = cursor.fetchone()
    if not inv:
        conn.close()
        return {"success": False, "error": "Invoice not found"}
        
    created_at = datetime.datetime.utcnow().isoformat()
    
    for alloc in allocations:
        alloc_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO allocations (id, invoice_id, funder_id, allocated_amount, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (alloc_id, invoice_id, alloc['funder_id'], alloc['allocated_amount'], created_at))
        
    # Mark invoice as SETTLEMENT_PENDING once fully allocated
    cursor.execute("UPDATE invoices SET status = 'SETTLEMENT_PENDING' WHERE id = ?", (invoice_id,))
    
    conn.commit()
    conn.close()
    return {"success": True, "message": f"{len(allocations)} allocations registered for {invoice_id}"}


def process_buyer_payment(invoice_id: str) -> Dict[str, Any]:
    """
    Receive buyer payment callback.
    Compute payoff = allocated_amount * 1.03 (principal + 3% interest for 90 days).
    Sum all payoffs. Remaining balance goes to MSME.
    Update invoice to SETTLED.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM invoices WHERE id = ?", (invoice_id,))
    inv = cursor.fetchone()
    
    if not inv:
        conn.close()
        return {"success": False, "error": "Invoice not found"}
        
    if inv['status'] != 'SETTLEMENT_PENDING':
        conn.close()
        return {"success": False, "error": f"Invoice status is {inv['status']}, must be SETTLEMENT_PENDING"}
        
    invoice_amount = inv['amount']
    supplier_id = inv['supplier_id']
    
    cursor.execute("SELECT * FROM allocations WHERE invoice_id = ?", (invoice_id,))
    allocs = cursor.fetchall()
    
    if not allocs:
        conn.close()
        return {"success": False, "error": "No funder allocations found for this invoice"}
    
    total_payoff = 0.0
    settled_at = datetime.datetime.utcnow().isoformat()
    
    settlement_events = []
    
    # Process each funder payoff
    for alloc in allocs:
        funder_id = alloc['funder_id']
        allocated_amount = alloc['allocated_amount']
        
        # 3% fixed yield
        payoff = round(allocated_amount * 1.03, 2)
        total_payoff += payoff
        
        settle_id = str(uuid.uuid4())
        cursor.execute('''
            INSERT INTO settlements (id, invoice_id, participant_id, participant_type, amount_paid, settled_at)
            VALUES (?, ?, ?, 'FUNDER', ?, ?)
        ''', (settle_id, invoice_id, funder_id, payoff, settled_at))
        
        settlement_events.append({
            "participantId": funder_id,
            "type": "FUNDER",
            "principal": allocated_amount,
            "interest": round(payoff - allocated_amount, 2),
            "totalPayoff": payoff
        })
        
    # Compute MSME residual payload
    msme_top_up = round(invoice_amount - total_payoff, 2)
    
    if msme_top_up < 0:
        # In a real system, you'd handle shortfalls. For now, zero floor.
        msme_top_up = 0.0
        
    # MSME Settlement
    msme_settle_id = str(uuid.uuid4())
    cursor.execute('''
        INSERT INTO settlements (id, invoice_id, participant_id, participant_type, amount_paid, settled_at)
        VALUES (?, ?, ?, 'MSME', ?, ?)
    ''', (msme_settle_id, invoice_id, supplier_id, msme_top_up, settled_at))
    
    settlement_events.append({
        "participantId": supplier_id,
        "type": "MSME",
        "principal": float(invoice_amount),
        "totalPayoff": msme_top_up
    })
    
    # Update Invoice Status
    cursor.execute("UPDATE invoices SET status = 'SETTLED' WHERE id = ?", (invoice_id,))
    
    conn.commit()
    conn.close()
    
    # Expose clear API event
    event_response = {
        "event": "InvoiceSettled",
        "invoiceId": invoice_id,
        "timestamp": settled_at,
        "totalInvoiceAmount": float(invoice_amount),
        "totalFunderPayoffs": round(total_payoff, 2),
        "msmeFinalTopUp": msme_top_up,
        "distributions": settlement_events
    }
    
    return {"success": True, "data": event_response}
