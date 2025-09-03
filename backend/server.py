from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import os
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
import json # Import json for serializing items_ordered

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

class MenuItemCreate(BaseModel):
    name: str
    alpha_code: str
    numeric_code: str
    price_fixed: float
    price_general: float
    price_ac: float

class BillItem(BaseModel):
    code: str
    name: str
    quantity: int
    unit_price: float
    line_total: float

class BillHeader(BaseModel):
    table_no: str
    party_no: str
    waiter_no: str
    section: Literal['AC', 'G']
    bill_number: Optional[str] = None

# Expanded Bill model to include all receipt details
class Bill(BaseModel):
    id: str
    header: BillHeader
    items: List[BillItem]
    subtotal: float
    tax_percent: float = 5.0
    tax_amount: float
    grand_total: float
    created_at: str
    hotel_name: str
    gstin: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""

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

class Credential(BaseModel):
    id: str
    staff_code: str
    role: Literal['clerk', 'admin']
    active: bool = True

class CredentialCreate(BaseModel):
    staff_code: str
    role: Literal['clerk', 'admin']
    active: bool = True

def create_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS menu (
            id UUID PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            alpha_code VARCHAR(10) UNIQUE NOT NULL,
            numeric_code VARCHAR(10) UNIQUE NOT NULL,
            price_fixed NUMERIC(10, 2) NOT NULL,
            price_general NUMERIC(10, 2) NOT NULL,
            price_ac NUMERIC(10, 2) NOT NULL,
            is_active BOOLEAN DEFAULT TRUE
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS bills (
            id UUID PRIMARY KEY,
            table_number VARCHAR(10),
            party_number VARCHAR(10),
            bill_number VARCHAR(255),
            section VARCHAR(2),
            items_ordered JSONB,
            total_amount NUMERIC(10, 2),
            created_at TIMESTAMPTZ
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS credentials (
            id UUID PRIMARY KEY,
            staff_code VARCHAR(10) UNIQUE NOT NULL,
            role VARCHAR(20) NOT NULL,
            active BOOLEAN DEFAULT TRUE
        );
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            id UUID PRIMARY KEY,
            hotel_name VARCHAR(255),
            gstin VARCHAR(255),
            phone VARCHAR(20),
            address TEXT
        );
    """)
    conn.commit()
    cursor.close()
    conn.close()

def now_local_iso() -> str:
    return datetime.now(TZ).isoformat()

def get_settings_doc():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM settings LIMIT 1")
    settings = cursor.fetchone()
    cursor.close()
    conn.close()
    if not settings:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
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
    create_tables()
    get_settings_doc() # Ensure default settings exist on startup

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

@api.post('/menu', response_model=MenuItem)
async def create_menu(item: MenuItemCreate):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        new_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO menu (id, name, alpha_code, numeric_code, price_fixed, price_general, price_ac, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (new_id, item.name, item.alpha_code.upper(), item.numeric_code.upper(), item.price_fixed, item.price_general, item.price_ac, True)
        )
        new_item = cursor.fetchone()
        conn.commit()
    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=409, detail='Code already exists')
    finally:
        cursor.close()
        conn.close()
    return new_item

@api.delete('/menu/{item_id}')
async def delete_menu_item(item_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM menu WHERE id = %s", (item_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "deleted"}

@api.get('/menu/lookup/{code}', response_model=MenuItem)
async def lookup_menu(code: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM menu WHERE alpha_code = %s OR numeric_code = %s", (code.upper(), code.upper()))
    item = cursor.fetchone()
    cursor.close()
    conn.close()
    if not item:
        raise HTTPException(status_code=404, detail='Item not found')
    return item

class BillCreateRequest(BaseModel):
    class Header(BaseModel):
        table_no: str
        party_no: str
        waiter_no: str
        section: Literal['AC', 'G']
        bill_number: Optional[str] = None
    header: Header
    item_codes: List[str]
    quantities: List[int]

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
            raise HTTPException(status_code=404, detail=f'Item not found: {code}')
        
        unit_price = float(item_data[price_field])
        line_total = round(unit_price * qty, 2)
        subtotal += line_total
        items.append(BillItem(code=code.upper(), name=item_data['name'], quantity=qty, unit_price=unit_price, line_total=line_total))

    subtotal = round(subtotal, 2)
    tax_percent = 5.0
    tax_amount = round(subtotal * tax_percent / 100.0, 2)
    grand_total = round(subtotal + tax_amount, 2)
    bill_no = payload.header.waiter_no
    bill_id = str(uuid.uuid4())
    created_at = now_local_iso()
    
    items_json = json.dumps([item.dict() for item in items])
    cursor.execute(
        """
        INSERT INTO bills (id, table_number, party_number, bill_number, section, items_ordered, total_amount, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (bill_id, payload.header.table_no, payload.header.party_no, bill_no, payload.header.section, items_json, grand_total, created_at)
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
        created_at=created_at,
        hotel_name=settings.get('hotel_name', DEFAULT_HOTEL_NAME),
        gstin=settings.get('gstin', ""),
        phone=settings.get('phone', ""),
        address=settings.get('address', "")
    )
    return bill

@api.get('/settings', response_model=Settings)
async def get_settings():
    settings = get_settings_doc()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@api.put('/settings', response_model=Settings)
async def update_settings(payload: SettingsUpdate):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id FROM settings LIMIT 1")
    setting_id_row = cursor.fetchone()
    setting_id = setting_id_row['id']
    
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    set_clause = ", ".join([f"{key} = %s" for key in update_data.keys()])
    values = list(update_data.values())
    values.append(setting_id)

    cursor.execute(f"UPDATE settings SET {set_clause} WHERE id = %s RETURNING *", tuple(values))
    updated_settings = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()
    return updated_settings

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api)