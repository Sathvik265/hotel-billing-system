from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from pathlib import Path
from datetime import datetime, timezone
import pytz
import os
import uuid

# Load env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB setup
MONGO_URL = os.environ.get('MONGO_URL')
if not MONGO_URL:
    raise RuntimeError('MONGO_URL is not set')
DB_NAME = os.environ.get('DB_NAME', 'test_database')
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# App and router
app = FastAPI()
api = APIRouter(prefix="/api")

# Constants
HOTEL_NAME = "Udupi Anand Bhavan, Charminar, Hyderabad"
TZ = pytz.timezone(os.environ.get('APP_TIMEZONE', 'Asia/Kolkata'))

# Models
class MenuItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
    code: str # can be alpha or numeric
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

class Bill(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    header: BillHeader
    items: List[BillItem]
    subtotal: float
    tax_percent: float = 5.0
    tax_amount: float
    grand_total: float
    created_at: str
    hotel_name: str = HOTEL_NAME

class StaffLoginRequest(BaseModel):
    staff_code: str  # e.g., SHI
    password: Optional[str] = None  # only for admin entry

class StaffLoginResponse(BaseModel):
    mode: Literal['clerk', 'admin-limited', 'admin-full']

# Helpers
async def seed_menu_if_empty():
    count = await db.menu.count_documents({})
    if count &gt; 0:
        return
    seed: List[MenuItem] = [
        MenuItem(name='Idli', alpha_code='IDL', numeric_code='101', price_fixed=30, price_general=35, price_ac=40),
        MenuItem(name='Vada', alpha_code='VAD', numeric_code='102', price_fixed=25, price_general=30, price_ac=35),
        MenuItem(name='Masala Dosa', alpha_code='MDS', numeric_code='201', price_fixed=60, price_general=70, price_ac=80),
        MenuItem(name='Plain Dosa', alpha_code='PDS', numeric_code='202', price_fixed=50, price_general=60, price_ac=70),
        MenuItem(name='Onion Uttapam', alpha_code='OUT', numeric_code='301', price_fixed=65, price_general=75, price_ac=85),
        MenuItem(name='Upma', alpha_code='UPM', numeric_code='302', price_fixed=35, price_general=40, price_ac=45),
        MenuItem(name='Poori Bhaji', alpha_code='PRB', numeric_code='401', price_fixed=50, price_general=60, price_ac=70),
        MenuItem(name='Lemon Rice', alpha_code='LMR', numeric_code='402', price_fixed=45, price_general=55, price_ac=65),
        MenuItem(name='Curd Rice', alpha_code='CRD', numeric_code='403', price_fixed=40, price_general=50, price_ac=60),
        MenuItem(name='Filter Coffee', alpha_code='COF', numeric_code='901', price_fixed=20, price_general=25, price_ac=30),
    ]
    await db.menu.insert_many([s.model_dump() for s in seed])

async def get_menu_by_code(code: str) -&gt; Optional[MenuItem]:
    code_upper = code.strip().upper()
    item = await db.menu.find_one({"$or": [{"alpha_code": code_upper}, {"numeric_code": code_upper}]})
    if not item:
        return None
    return MenuItem(**item)

def now_local_iso() -&gt; str:
    return datetime.now(TZ).isoformat()

async def next_bill_number() -&gt; str:
    # daily counter collection: bill_counters with date_key and seq
    today = datetime.now(TZ).strftime('%Y%m%d')
    doc = await db.bill_counters.find_one_and_update(
        {"date_key": today},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = doc.get('seq', 1)
    return f"{today}-{seq:03d}"

# Startup tasks
@app.on_event('startup')
async def on_startup():
    await seed_menu_if_empty()

# Routes
@api.get('/')
async def root():
    return {"message": "Hotel Billing API running"}

@api.post('/auth/login', response_model=StaffLoginResponse)
async def staff_login(payload: StaffLoginRequest):
    staff_code = payload.staff_code.strip().upper()
    # Admin code is SHI as provided
    if staff_code == 'SHI':
        # Two-level passwords
        if payload.password is None or payload.password == '':
            # Enter as clerk unless password supplied
            return StaffLoginResponse(mode='clerk')
        if payload.password == 'udupi-l1':
            return StaffLoginResponse(mode='admin-limited')
        if payload.password == 'udupi-root':
            return StaffLoginResponse(mode='admin-full')
        raise HTTPException(status_code=401, detail='Invalid admin password')
    # Non-admin codes become clerks silently
    return StaffLoginResponse(mode='clerk')

@api.get('/menu', response_model=List[MenuItem])
async def list_menu():
    items = await db.menu.find({"is_active": True}).sort("name", 1).to_list(length=1000)
    return [MenuItem(**it) for it in items]

@api.post('/menu', response_model=MenuItem)
async def create_menu(item: MenuItemCreate):
    exists = await db.menu.find_one({"$or": [{"alpha_code": item.alpha_code.upper()}, {"numeric_code": item.numeric_code.upper()}]})
    if exists:
        raise HTTPException(status_code=409, detail='Code already exists')
    data = MenuItem(
        name=item.name,
        alpha_code=item.alpha_code.upper(),
        numeric_code=item.numeric_code.upper(),
        price_fixed=item.price_fixed,
        price_general=item.price_general,
        price_ac=item.price_ac,
        is_active=True
    )
    await db.menu.insert_one(data.model_dump())
    return data

@api.get('/menu/lookup/{code}', response_model=MenuItem)
async def lookup_menu(code: str):
    item = await get_menu_by_code(code)
    if not item:
        raise HTTPException(status_code=404, detail='Item not found')
    return item

class BillCreateRequest(BaseModel):
    header: BillHeader
    item_codes: List[str]
    quantities: List[int]

@api.post('/bill', response_model=Bill)
async def create_bill(payload: BillCreateRequest):
    if len(payload.item_codes) != len(payload.quantities):
        raise HTTPException(status_code=400, detail='Item codes and quantities mismatch')

    # Determine pricing column based on section G/AC
    price_field = 'price_ac' if payload.header.section == 'AC' else 'price_general'

    items: List[BillItem] = []
    subtotal = 0.0

    for code, qty in zip(payload.item_codes, payload.quantities):
        item = await get_menu_by_code(code)
        if not item:
            raise HTTPException(status_code=404, detail=f'Item not found: {code}')
        unit_price = getattr(item, price_field)
        line_total = round(unit_price * qty, 2)
        subtotal += line_total
        items.append(BillItem(code=code.upper(), name=item.name, quantity=qty, unit_price=unit_price, line_total=line_total))

    subtotal = round(subtotal, 2)
    tax_percent = 5.0
    tax_amount = round(subtotal * tax_percent / 100.0, 2)
    grand_total = round(subtotal + tax_amount, 2)

    # Bill number handling: auto if not provided
    bill_no = payload.header.bill_number or await next_bill_number()

    bill = Bill(
        header=BillHeader(
            table_no=payload.header.table_no,
            party_no=payload.header.party_no,
            waiter_no=payload.header.waiter_no,
            section=payload.header.section,
            bill_number=bill_no
        ),
        items=items,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        created_at=now_local_iso(),
    )

    await db.bills.insert_one(bill.model_dump())
    return bill

# Admin stub endpoints (list only, functionalities later)
@api.get('/admin/actions', response_model=List[str])
async def admin_actions():
    return ['pending', 'update', 'rectify', 'reindex', 'create', 'report']

# Include router
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api)