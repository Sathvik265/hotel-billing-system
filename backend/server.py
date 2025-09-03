from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from pathlib import Path
from datetime import datetime, date
from zoneinfo import ZoneInfo
import os
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# PostgreSQL setup
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL is not set')

def get_db_connection():
    conn = psycopg2.connect(DATABASE_URL)
    return conn

# App and router
app = FastAPI()
api = APIRouter(prefix="/api")

# Constants
DEFAULT_HOTEL_NAME = "Udupi Anand Bhavan, Charminar, Hyderabad"
TZ = ZoneInfo(os.environ.get('APP_TIMEZONE', 'Asia/Kolkata'))

# Models
class MenuItem(BaseModel):
    id: str
    name: str
    alpha_code: str
    numeric_code: str
    price_fixed: float
    price_general: float
    price_ac: float
    is_active: bool = True

class BillItem(BaseModel):
    code: str
    name: str
    quantity: int
    unit_price: float
    line_total: float

class BillHeader(BaseModel):
    table_no: str
    party_no: str
    section: Literal['AC', 'G']
    bill_number: Optional[str] = None

class Bill(BaseModel):
    id: str
    header: BillHeader
    items: List[BillItem]
    subtotal: float
    tax_percent: float = 5.0
    tax_amount: float
    grand_total: float
    created_at: str
    bill_date: date
    hotel_name: str
    gstin: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    modified_from_bill_id: Optional[str] = None

class StaffLoginRequest(BaseModel):
    staff_code: str
    is_root: bool = False

class StaffLoginResponse(BaseModel):
    mode: Literal['clerk', 'admin-limited', 'admin-full']

class Settings(BaseModel):
    id: str
    hotel_name: str = DEFAULT_HOTEL_NAME
    gstin: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""

class SettingsUpdate(BaseModel):
    hotel_name: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


def get_settings_doc():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM settings LIMIT 1")
    settings = cursor.fetchone()
    if not settings:
        new_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO settings (id, hotel_name) VALUES (%s, %s) RETURNING *",
            (new_id, DEFAULT_HOTEL_NAME)
        )
        settings = cursor.fetchone()
        conn.commit()
    cursor.close()
    conn.close()
    return settings

@app.on_event('startup')
async def on_startup():
    get_settings_doc()

@api.get('/')
async def root():
    return {"message": "Hotel Billing API running"}

@api.post('/auth/login', response_model=StaffLoginResponse)
async def staff_login(payload: StaffLoginRequest):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM credentials WHERE staff_code = %s AND active = TRUE", (payload.staff_code.strip().upper(),))
    cred_doc = cursor.fetchone()
    cursor.close()
    conn.close()
    if not cred_doc:
        raise HTTPException(status_code=401, detail='Invalid credentials')
    if cred_doc['role'] == 'admin':
        return StaffLoginResponse(mode='admin-full' if payload.is_root else 'admin-limited')
    else:
        return StaffLoginResponse(mode='clerk')

@api.get('/menu', response_model=List[MenuItem])
async def list_menu():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM menu WHERE is_active = TRUE ORDER BY name")
    items = cursor.fetchall()
    cursor.close()
    conn.close()
    return items

@api.get('/menu/lookup/{code}', response_model=MenuItem)
async def lookup_menu(code: str):
    code_upper = code.strip().upper()
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM menu WHERE alpha_code = %s OR numeric_code = %s", (code_upper, code_upper))
    item = cursor.fetchone()
    cursor.close()
    conn.close()
    if not item:
        raise HTTPException(status_code=404, detail='Item not found')
    return MenuItem(**item)

class BillCreateRequest(BaseModel):
    class Header(BaseModel):
        table_no: str
        party_no: str
        section: Literal['AC', 'G']
        bill_number: Optional[str] = None
    header: Header
    item_codes: List[str]
    quantities: List[int]
    bill_date: date
    modified_from_bill_id: Optional[str] = None

@api.post('/bill', response_model=Bill)
async def create_bill(payload: BillCreateRequest):
    if len(payload.item_codes) != len(payload.quantities):
        raise HTTPException(status_code=400, detail='Item codes and quantities mismatch')

    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    price_field = 'price_ac' if payload.header.section == 'AC' else 'price_general'
    items: List[BillItem] = []
    subtotal = 0.0

    for code, qty in zip(payload.item_codes, payload.quantities):
        cursor.execute("SELECT * FROM menu WHERE alpha_code = %s OR numeric_code = %s", (code.upper(), code.upper()))
        item_data = cursor.fetchone()
        if not item_data:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f'Item not found: {code}')
        
        unit_price = float(item_data[price_field])
        line_total = round(unit_price * qty, 2)
        subtotal += line_total
        items.append(BillItem(code=code.upper(), name=item_data['name'], quantity=qty, unit_price=unit_price, line_total=line_total))

    subtotal = round(subtotal, 2)
    tax_percent = 5.0
    tax_amount = round(subtotal * tax_percent / 100.0, 2)
    grand_total = round(subtotal + tax_amount, 2)
    bill_no = payload.header.bill_number
    bill_id = str(uuid.uuid4())
    created_at = datetime.now(TZ)
    
    items_json = json.dumps([item.dict() for item in items])
    cursor.execute(
        """
        INSERT INTO bills (id, table_number, party_number, bill_number, section, items_ordered, total_amount, created_at, bill_date, modified_from_bill_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (bill_id, payload.header.table_no, payload.header.party_no, bill_no, payload.header.section, items_json, grand_total, created_at, payload.bill_date, payload.modified_from_bill_id)
    )
    conn.commit()
    cursor.close()
    conn.close()

    settings = get_settings_doc()

    bill = Bill(
        id=bill_id,
        header=BillHeader(**payload.header.dict()),
        items=items,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        created_at=created_at.isoformat(),
        bill_date=payload.bill_date,
        hotel_name=settings.get('hotel_name', DEFAULT_HOTEL_NAME),
        gstin=settings.get('gstin', ""),
        phone=settings.get('phone', ""),
        address=settings.get('address', ""),
        modified_from_bill_id=payload.modified_from_bill_id
    )
    return bill

@api.get('/bills/by_date', response_model=List[Bill])
async def get_bills_by_date(bill_date: date):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "SELECT * FROM bills WHERE bill_date = %s ORDER BY created_at DESC",
        (bill_date,)
    )
    bills_data = cursor.fetchall()
    cursor.close()
    conn.close()

    settings = get_settings_doc()
    bills = []
    for bill_data in bills_data:
        subtotal_calc = float(bill_data['total_amount']) / 1.05 if bill_data['total_amount'] is not None else 0
        bills.append(Bill(
            id=str(bill_data['id']),
            header=BillHeader(
                table_no=bill_data['table_number'],
                party_no=bill_data['party_number'],
                section=bill_data['section'],
                bill_number=bill_data['bill_number']
            ),
            items=[BillItem(**item) for item in (bill_data['items_ordered'] or [])],
            subtotal=subtotal_calc,
            tax_percent=5.0,
            tax_amount=float(bill_data['total_amount']) - subtotal_calc if bill_data['total_amount'] is not None else 0,
            grand_total=float(bill_data['total_amount'] or 0),
            created_at=bill_data['created_at'].isoformat(),
            bill_date=bill_data['bill_date'],
            hotel_name=settings.get('hotel_name', DEFAULT_HOTEL_NAME),
            gstin=settings.get('gstin', ""),
            phone=settings.get('phone', ""),
            address=settings.get('address', ""),
            modified_from_bill_id=str(bill_data['modified_from_bill_id']) if bill_data.get('modified_from_bill_id') else None,
        ))
    return bills

@api.get('/bill/last', response_model=Bill)
async def get_last_bill(table_no: str, bill_date: date):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        "SELECT * FROM bills WHERE table_number = %s AND bill_date = %s ORDER BY created_at DESC LIMIT 1",
        (table_no, bill_date)
    )
    bill_data = cursor.fetchone()
    cursor.close()
    conn.close()
    if not bill_data:
        raise HTTPException(status_code=404, detail="No bill found for this table on the given date")

    settings = get_settings_doc()
    subtotal_calc = float(bill_data['total_amount']) / 1.05 if bill_data['total_amount'] is not None else 0
    bill = Bill(
        id=str(bill_data['id']),
        header=BillHeader(
            table_no=bill_data['table_number'],
            party_no=bill_data['party_number'],
            section=bill_data['section'],
            bill_number=bill_data['bill_number']
        ),
        items=[BillItem(**item) for item in (bill_data['items_ordered'] or [])],
        subtotal=subtotal_calc,
        tax_percent=5.0,
        tax_amount=float(bill_data['total_amount']) - subtotal_calc if bill_data['total_amount'] is not None else 0,
        grand_total=float(bill_data['total_amount'] or 0),
        created_at=bill_data['created_at'].isoformat(),
        bill_date=bill_data['bill_date'],
        hotel_name=settings.get('hotel_name', DEFAULT_HOTEL_NAME),
        gstin=settings.get('gstin', ""),
        phone=settings.get('phone', ""),
        address=settings.get('address', ""),
        modified_from_bill_id=str(bill_data['modified_from_bill_id']) if bill_data.get('modified_from_bill_id') else None,
    )
    return bill

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api)

