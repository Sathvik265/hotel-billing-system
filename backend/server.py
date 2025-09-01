from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import os
import uuid
from pymongo import ReturnDocument

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
DEFAULT_HOTEL_NAME = "Udupi Anand Bhavan, Charminar, Hyderabad"
TZ = ZoneInfo(os.environ.get('APP_TIMEZONE', 'Asia/Kolkata'))

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
    code: str  # can be alpha or numeric
    name: str
    quantity: int
    unit_price: float
    line_total: float

class BillHeader(BaseModel):
    table_no: str
    party_no: str
    waiter_no: str
    section: Literal['AC', 'G']
    bill_number: Optional[str] = None  # populated by server if not provided

class Bill(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    header: BillHeader
    items: List[BillItem]
    subtotal: float
    tax_percent: float = 5.0
    tax_amount: float
    grand_total: float
    created_at: str
    hotel_name: str

class StaffLoginRequest(BaseModel):
    staff_code: str  # e.g., SHI
    password: Optional[str] = None  # required for admin, optional for clerk

class StaffLoginResponse(BaseModel):
    mode: Literal['clerk', 'admin-limited', 'admin-full']

class Settings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    hotel_name: str = DEFAULT_HOTEL_NAME
    gstin: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""

class SettingsUpdate(BaseModel):
    hotel_name: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

# Credentials models
class Credential(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    staff_code: str
    role: Literal['clerk', 'admin']
    password: Optional[str] = None           # for clerks (optional)
    password_l1: Optional[str] = None        # for admin limited
    password_root: Optional[str] = None      # for admin full
    active: bool = True

class CredentialCreate(BaseModel):
    staff_code: str
    role: Literal['clerk', 'admin']
    password: Optional[str] = None
    password_l1: Optional[str] = None
    password_root: Optional[str] = None
    active: bool = True

class CredentialUpdate(BaseModel):
    role: Optional[Literal['clerk', 'admin']] = None
    password: Optional[str] = None
    password_l1: Optional[str] = None
    password_root: Optional[str] = None
    active: Optional[bool] = None

# Helpers
async def seed_menu_if_empty():
    count = await db.menu.count_documents({})
    if count > 0:
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

async def seed_credentials_if_empty():
    count = await db.credentials.count_documents({})
    if count == 0:
        # Default admin and a sample clerk
        admin = Credential(
            staff_code='SHI', role='admin', password_l1='udupi-l1', password_root='udupi-root', active=True
        )
        clerk = Credential(
            staff_code='CLK', role='clerk', password=None, active=True
        )
        await db.credentials.insert_many([admin.model_dump(), clerk.model_dump()])

async def get_menu_by_code(code: str) -> Optional[MenuItem]:
    code_upper = code.strip().upper()
    item = await db.menu.find_one({"$or": [{"alpha_code": code_upper}, {"numeric_code": code_upper}]})
    if not item:
        return None
    return MenuItem(**item)

async def get_settings_doc() -> Settings:
    doc = await db.settings.find_one({})
    if not doc:
        default = Settings()
        await db.settings.insert_one(default.model_dump())
        return default
    return Settings(**doc)

async def save_settings(update: SettingsUpdate) -> Settings:
    upd = {k: v for k, v in update.model_dump().items() if v is not None}
    doc = await db.settings.find_one_and_update(
        {},
        {"$set": upd},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        new_doc = Settings(**{**Settings().model_dump(), **upd})
        await db.settings.insert_one(new_doc.model_dump())
        return new_doc
    return Settings(**doc)


def now_local_iso() -> str:
    return datetime.now(TZ).isoformat()

# Startup tasks
@app.on_event('startup')
async def on_startup():
    await seed_menu_if_empty()
    await seed_credentials_if_empty()
    await get_settings_doc()

# Routes
@api.get('/')
async def root():
    return {"message": "Hotel Billing API running"}

# Authentication based on stored credentials
@api.post('/auth/login', response_model=StaffLoginResponse)
async def staff_login(payload: StaffLoginRequest):
    code = payload.staff_code.strip().upper()
    cred_doc = await db.credentials.find_one({"staff_code": code, "active": True})
    if not cred_doc:
        raise HTTPException(status_code=401, detail='Invalid credentials')

    cred = Credential(**cred_doc)
    if cred.role == 'admin':
        if not payload.password:
            raise HTTPException(status_code=401, detail='Password required')
        if cred.password_l1 and payload.password == cred.password_l1:
            return StaffLoginResponse(mode='admin-limited')
        if cred.password_root and payload.password == cred.password_root:
            return StaffLoginResponse(mode='admin-full')
        raise HTTPException(status_code=401, detail='Invalid admin password')
    else:
        # clerk
        if cred.password is not None:
            if payload.password != cred.password:
                raise HTTPException(status_code=401, detail='Invalid clerk password')
        return StaffLoginResponse(mode='clerk')

# Credentials management (no auth in MVP; UI limits to admin-full)
@api.get('/credentials', response_model=List[Credential])
async def list_credentials():
    rows = await db.credentials.find({}).sort("staff_code", 1).to_list(length=500)
    return [Credential(**r) for r in rows]

@api.post('/credentials', response_model=Credential)
async def create_credential(payload: CredentialCreate):
    code = payload.staff_code.strip().upper()
    exists = await db.credentials.find_one({"staff_code": code})
    if exists:
        raise HTTPException(status_code=409, detail='Staff code already exists')
    cred = Credential(
        staff_code=code,
        role=payload.role,
        password=payload.password,
        password_l1=payload.password_l1,
        password_root=payload.password_root,
        active=payload.active,
    )
    await db.credentials.insert_one(cred.model_dump())
    return cred

@api.put('/credentials/{cred_id}', response_model=Credential)
async def update_credential(cred_id: str, payload: CredentialUpdate):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    doc = await db.credentials.find_one_and_update(
        {"id": cred_id},
        {"$set": upd},
        return_document=ReturnDocument.AFTER,
    )
    if not doc:
        raise HTTPException(status_code=404, detail='Credential not found')
    return Credential(**doc)

@api.delete('/credentials/{cred_id}')
async def delete_credential(cred_id: str):
    res = await db.credentials.delete_one({"id": cred_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail='Credential not found')
    return {"status": "deleted"}

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

    # Bill number policy: default to waiter_no but allow provided bill_number
    bill_no = payload.header.bill_number or payload.header.waiter_no

    settings = await get_settings_doc()

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
        hotel_name=settings.hotel_name or DEFAULT_HOTEL_NAME,
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