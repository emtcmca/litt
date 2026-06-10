import sys, os
sys.path.insert(0, r'C:\dev\litt\backend')
os.chdir(r'C:\dev\litt\backend')
os.environ.setdefault('LITT_DEMO_MODE', 'true')
os.environ.setdefault('LITT_DEMO_FIRM_ID', 'strand-okafor')

from app.db import get_db

FIRM_ID = 'strand-okafor'

def col(db, name):
    return db.collection('firms').document(FIRM_ID).collection(name)

db = get_db()

extra_escalations = ['esc-seed-003', 'esc-seed-004', 'esc-seed-005']
for eid in extra_escalations:
    ref = col(db, 'escalations').document(eid)
    doc = ref.get()
    if doc.exists:
        ref.delete()
        print(f'Deleted escalation {eid}')
    else:
        print(f'  {eid} not found (ok)')

extra_inbox = ['inbound-acme-billing', 'inbound-opp-counsel-001']
for iid in extra_inbox:
    ref = col(db, 'inbound_messages').document(iid)
    doc = ref.get()
    if doc.exists:
        ref.delete()
        print(f'Deleted inbox {iid}')
    else:
        print(f'  {iid} not found (ok)')

print('Done')
