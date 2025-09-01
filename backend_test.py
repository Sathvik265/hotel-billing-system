#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class HotelBillingAPITester:
    def __init__(self, base_url="https://menubilling.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def test_api_root(self):
        """Test GET /api/ endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            expected_message = "Hotel Billing API running"
            
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == expected_message:
                    return self.log_test("API Root", True, f"- Status: {response.status_code}, Message: {data.get('message')}")
                else:
                    return self.log_test("API Root", False, f"- Wrong message: {data}")
            else:
                return self.log_test("API Root", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("API Root", False, f"- Error: {str(e)}")

    def test_menu_list(self):
        """Test GET /api/menu endpoint"""
        try:
            response = requests.get(f"{self.api_url}/menu", timeout=10)
            
            if response.status_code == 200:
                items = response.json()
                if len(items) >= 5:
                    # Check if IDL item exists
                    idl_found = any(item.get("alpha_code") == "IDL" for item in items)
                    if idl_found:
                        return self.log_test("Menu List", True, f"- {len(items)} items found, IDL item present")
                    else:
                        return self.log_test("Menu List", False, f"- IDL item not found in {len(items)} items")
                else:
                    return self.log_test("Menu List", False, f"- Only {len(items)} items found, expected >=5")
            else:
                return self.log_test("Menu List", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Menu List", False, f"- Error: {str(e)}")

    def test_menu_lookup(self):
        """Test GET /api/menu/lookup/IDL endpoint"""
        try:
            response = requests.get(f"{self.api_url}/menu/lookup/IDL", timeout=10)
            
            if response.status_code == 200:
                item = response.json()
                if item.get("name") == "Idli" and item.get("alpha_code") == "IDL":
                    return self.log_test("Menu Lookup IDL", True, f"- Found: {item.get('name')} ({item.get('alpha_code')})")
                else:
                    return self.log_test("Menu Lookup IDL", False, f"- Wrong item: {item}")
            else:
                return self.log_test("Menu Lookup IDL", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Menu Lookup IDL", False, f"- Error: {str(e)}")

    def test_bill_creation(self):
        """Test POST /api/bill endpoint with specific calculation"""
        try:
            # Test data as specified in requirements
            payload = {
                "header": {
                    "table_no": "1",
                    "party_no": "1", 
                    "waiter_no": "1",
                    "section": "G"
                },
                "item_codes": ["IDL", "201"],  # IDL and Masala Dosa (numeric code)
                "quantities": [1, 1]
            }
            
            response = requests.post(f"{self.api_url}/bill", json=payload, timeout=10)
            
            if response.status_code == 200:
                bill = response.json()
                
                # Verify tax percentage
                if bill.get("tax_percent") != 5.0:
                    return self.log_test("Bill Creation", False, f"- Wrong tax percent: {bill.get('tax_percent')}")
                
                # Calculate expected total: IDL general (35) + MDS general (70) = 105, tax 5% = 5.25, total = 110.25
                expected_subtotal = 35 + 70  # IDL + Masala Dosa general prices
                expected_tax = round(expected_subtotal * 0.05, 2)
                expected_total = round(expected_subtotal + expected_tax, 2)
                
                actual_total = bill.get("grand_total")
                
                if actual_total == expected_total:
                    # Check bill number format YYYYMMDD-###
                    bill_number = bill.get("header", {}).get("bill_number", "")
                    if len(bill_number) == 12 and bill_number[8] == "-":
                        return self.log_test("Bill Creation", True, f"- Total: {actual_total}, Bill: {bill_number}")
                    else:
                        return self.log_test("Bill Creation", False, f"- Wrong bill number format: {bill_number}")
                else:
                    return self.log_test("Bill Creation", False, f"- Wrong total: {actual_total}, expected: {expected_total}")
            else:
                return self.log_test("Bill Creation", False, f"- Status: {response.status_code}")
                
        except Exception as e:
            return self.log_test("Bill Creation", False, f"- Error: {str(e)}")

    def test_staff_login(self):
        """Test POST /api/auth/login endpoint"""
        try:
            # Test clerk login
            clerk_payload = {"staff_code": "ABC"}
            response = requests.post(f"{self.api_url}/auth/login", json=clerk_payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("mode") == "clerk":
                    clerk_success = True
                else:
                    clerk_success = False
                    self.log_test("Staff Login (Clerk)", False, f"- Wrong mode: {data.get('mode')}")
            else:
                clerk_success = False
                self.log_test("Staff Login (Clerk)", False, f"- Status: {response.status_code}")
            
            # Test admin login
            admin_payload = {"staff_code": "SHI", "password": "udupi-l1"}
            response = requests.post(f"{self.api_url}/auth/login", json=admin_payload, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("mode") == "admin-limited":
                    admin_success = True
                else:
                    admin_success = False
                    self.log_test("Staff Login (Admin)", False, f"- Wrong mode: {data.get('mode')}")
            else:
                admin_success = False
                self.log_test("Staff Login (Admin)", False, f"- Status: {response.status_code}")
            
            if clerk_success and admin_success:
                return self.log_test("Staff Login", True, "- Both clerk and admin login working")
            else:
                return self.log_test("Staff Login", False, "- One or both login types failed")
                
        except Exception as e:
            return self.log_test("Staff Login", False, f"- Error: {str(e)}")

    def run_all_tests(self):
        """Run all backend API tests"""
        print("🚀 Starting Hotel Billing API Tests")
        print(f"📍 Testing against: {self.api_url}")
        print("=" * 60)
        
        # Run all tests
        self.test_api_root()
        self.test_menu_list()
        self.test_menu_lookup()
        self.test_bill_creation()
        self.test_staff_login()
        
        print("=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests PASSED!")
            return True
        else:
            print("⚠️  Some backend tests FAILED!")
            return False

def main():
    tester = HotelBillingAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())