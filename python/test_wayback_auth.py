#!/usr/bin/env python3
"""
Wayback Machine Authentication Test Script

Tests authenticated vs unauthenticated access to archived snapshots.
Stores credentials securely in .env file (gitignored).
"""

import os
import sys
import time
import requests
from pathlib import Path
from typing import Optional, Dict, Tuple

# Project root
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

# Test URL - earliest justSteve.com snapshot
TEST_TIMESTAMP = "19970601032128"
TEST_URL = "http://www.juststeve.com:80/"
WAYBACK_URL = f"https://web.archive.org/web/{TEST_TIMESTAMP}id_/{TEST_URL}"


def load_env() -> Dict[str, str]:
    """Load environment variables from .env file."""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip().strip('"\'')
    return env_vars


def save_env(env_vars: Dict[str, str]) -> None:
    """Save environment variables to .env file."""
    existing = load_env()
    existing.update(env_vars)

    with open(ENV_FILE, 'w') as f:
        f.write("# Internet Archive Credentials\n")
        f.write("# DO NOT COMMIT THIS FILE\n\n")
        for key, value in existing.items():
            f.write(f'{key}="{value}"\n')

    print(f"Credentials saved to {ENV_FILE}")


def get_credentials() -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    """Get IA credentials from .env or prompt user."""
    env = load_env()

    logged_in_user = env.get('IA_LOGGED_IN_USER')
    logged_in_sig = env.get('IA_LOGGED_IN_SIG')
    s3_access = env.get('IA_S3_ACCESS')
    s3_secret = env.get('IA_S3_SECRET')

    return logged_in_user, logged_in_sig, s3_access, s3_secret


def prompt_for_credentials() -> None:
    """Interactively prompt for credentials and save them."""
    print("\n" + "="*60)
    print("Internet Archive Credentials Setup")
    print("="*60)
    print("\nTo get your credentials:")
    print("1. Log into https://archive.org")
    print("2. Open DevTools (F12) -> Application -> Cookies -> archive.org")
    print("3. Copy the values for 'logged-in-user' and 'logged-in-sig'")
    print("\nFor S3 keys (optional):")
    print("4. Go to https://archive.org/account/s3.php")
    print("5. Generate keys and copy access/secret")
    print("\n" + "-"*60)

    env_vars = {}

    logged_in_user = input("\nlogged-in-user cookie value (or Enter to skip): ").strip()
    if logged_in_user:
        env_vars['IA_LOGGED_IN_USER'] = logged_in_user

        logged_in_sig = input("logged-in-sig cookie value: ").strip()
        if logged_in_sig:
            env_vars['IA_LOGGED_IN_SIG'] = logged_in_sig

    s3_access = input("\nS3 Access Key (or Enter to skip): ").strip()
    if s3_access:
        env_vars['IA_S3_ACCESS'] = s3_access

        s3_secret = input("S3 Secret Key: ").strip()
        if s3_secret:
            env_vars['IA_S3_SECRET'] = s3_secret

    if env_vars:
        save_env(env_vars)
    else:
        print("\nNo credentials provided. Running unauthenticated tests only.")


def fetch_snapshot(authenticated: bool = False,
                   logged_in_user: str = None,
                   logged_in_sig: str = None,
                   s3_access: str = None,
                   s3_secret: str = None) -> Dict:
    """Fetch a Wayback snapshot and return results."""

    headers = {
        'User-Agent': 'justSteve-archiver/1.0 (personal archive project; contact@juststeve.com)'
    }
    cookies = {}

    if authenticated:
        if logged_in_user and logged_in_sig:
            cookies['logged-in-user'] = logged_in_user
            cookies['logged-in-sig'] = logged_in_sig

        if s3_access and s3_secret:
            headers['Authorization'] = f'LOW {s3_access}:{s3_secret}'

    auth_type = "authenticated" if authenticated else "unauthenticated"
    print(f"\nFetching ({auth_type})...")
    print(f"  URL: {WAYBACK_URL[:70]}...")

    start_time = time.time()

    try:
        response = requests.get(
            WAYBACK_URL,
            headers=headers,
            cookies=cookies if cookies else None,
            timeout=30
        )
        elapsed = time.time() - start_time

        return {
            'success': True,
            'status_code': response.status_code,
            'content_length': len(response.content),
            'headers': dict(response.headers),
            'elapsed': elapsed,
            'content_preview': response.text[:500] if response.text else None,
            'rate_limit_remaining': response.headers.get('X-RateLimit-Remaining'),
            'rate_limit_limit': response.headers.get('X-RateLimit-Limit'),
        }

    except requests.RequestException as e:
        return {
            'success': False,
            'error': str(e),
            'elapsed': time.time() - start_time
        }


def compare_results(unauth: Dict, auth: Dict) -> None:
    """Compare authenticated vs unauthenticated results."""

    print("\n" + "="*60)
    print("COMPARISON: Authenticated vs Unauthenticated")
    print("="*60)

    print(f"\n{'Metric':<25} {'Unauth':<20} {'Auth':<20}")
    print("-"*65)

    if unauth['success'] and auth['success']:
        print(f"{'Status Code':<25} {unauth['status_code']:<20} {auth['status_code']:<20}")
        print(f"{'Content Length':<25} {unauth['content_length']:<20} {auth['content_length']:<20}")
        print(f"{'Response Time':<25} {unauth['elapsed']:.3f}s{'':<14} {auth['elapsed']:.3f}s")

        # Check for rate limit headers
        if unauth.get('rate_limit_remaining') or auth.get('rate_limit_remaining'):
            print(f"{'Rate Limit Remaining':<25} {unauth.get('rate_limit_remaining', 'N/A'):<20} {auth.get('rate_limit_remaining', 'N/A'):<20}")
            print(f"{'Rate Limit Total':<25} {unauth.get('rate_limit_limit', 'N/A'):<20} {auth.get('rate_limit_limit', 'N/A'):<20}")

        # Content match
        content_match = unauth['content_length'] == auth['content_length']
        print(f"\n{'Content Match:':<25} {'YES' if content_match else 'NO - DIFFERENT!'}")

        # Check interesting headers
        print("\nInteresting Headers:")
        interesting = ['x-archive-src', 'x-app-server', 'server-timing', 'x-ts', 'x-tr']
        for header in interesting:
            unauth_val = unauth['headers'].get(header, 'N/A')[:30] if unauth['headers'].get(header) else 'N/A'
            auth_val = auth['headers'].get(header, 'N/A')[:30] if auth['headers'].get(header) else 'N/A'
            if unauth_val != 'N/A' or auth_val != 'N/A':
                print(f"  {header}: {unauth_val} | {auth_val}")

    else:
        if not unauth['success']:
            print(f"Unauthenticated FAILED: {unauth.get('error')}")
        if not auth['success']:
            print(f"Authenticated FAILED: {auth.get('error')}")

    print("\n" + "="*60)


def run_tests() -> None:
    """Run the authentication comparison tests."""

    print("\n" + "="*60)
    print("Wayback Machine Authentication Test")
    print("="*60)
    print(f"\nTest Target: justSteve.com (June 1997)")
    print(f"Timestamp: {TEST_TIMESTAMP}")

    # Get credentials
    logged_in_user, logged_in_sig, s3_access, s3_secret = get_credentials()

    has_cookies = logged_in_user and logged_in_sig
    has_s3 = s3_access and s3_secret

    print(f"\nCredentials Status:")
    print(f"  Logged-in Cookies: {'Found' if has_cookies else 'Not configured'}")
    print(f"  S3 Keys: {'Found' if has_s3 else 'Not configured'}")

    if not has_cookies and not has_s3:
        print("\nNo credentials found. Run with --setup to configure.")
        print("Proceeding with unauthenticated test only...")

    # Test 1: Unauthenticated
    print("\n" + "-"*60)
    print("TEST 1: Unauthenticated Request")
    print("-"*60)
    unauth_result = fetch_snapshot(authenticated=False)

    if unauth_result['success']:
        print(f"  Status: {unauth_result['status_code']}")
        print(f"  Size: {unauth_result['content_length']} bytes")
        print(f"  Time: {unauth_result['elapsed']:.3f}s")
    else:
        print(f"  FAILED: {unauth_result['error']}")

    # Test 2: Authenticated (if credentials available)
    auth_result = None
    if has_cookies or has_s3:
        print("\n" + "-"*60)
        print("TEST 2: Authenticated Request")
        print("-"*60)

        # Brief delay to avoid rate limiting
        time.sleep(2)

        auth_result = fetch_snapshot(
            authenticated=True,
            logged_in_user=logged_in_user,
            logged_in_sig=logged_in_sig,
            s3_access=s3_access,
            s3_secret=s3_secret
        )

        if auth_result['success']:
            print(f"  Status: {auth_result['status_code']}")
            print(f"  Size: {auth_result['content_length']} bytes")
            print(f"  Time: {auth_result['elapsed']:.3f}s")
        else:
            print(f"  FAILED: {auth_result['error']}")

        # Compare
        compare_results(unauth_result, auth_result)

    # Summary
    print("\nSUMMARY")
    print("-"*60)
    if unauth_result['success']:
        print("Unauthenticated access: WORKS")
    else:
        print("Unauthenticated access: BLOCKED")

    if auth_result:
        if auth_result['success']:
            print("Authenticated access: WORKS")
            if auth_result['status_code'] == unauth_result.get('status_code'):
                print("\nConclusion: Auth doesn't change access for this content.")
                print("Auth may still help with rate limits during bulk operations.")
        else:
            print("Authenticated access: FAILED")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--setup':
        prompt_for_credentials()

    run_tests()


if __name__ == "__main__":
    main()
