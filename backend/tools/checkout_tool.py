"""
Wraps your existing UPI buyer-page builder.

REPLACE with your real /p/{id} page logic if you already have one — this
stub just builds the upi://pay deep link your README says already works.
"""
import os
import urllib.parse

UPI_VPA = os.getenv("ECHO_UPI_VPA", "creator@upi")
CREATOR_NAME = os.getenv("ECHO_CREATOR_NAME", "Creator")


def build_upi_deep_link(product_name: str, price_inr: int) -> str:
    params = {
        "pa": UPI_VPA,
        "pn": CREATOR_NAME,
        "am": str(price_inr),
        "cu": "INR",
        "tn": f"Payment for {product_name}",
    }
    return "upi://pay?" + urllib.parse.urlencode(params)
