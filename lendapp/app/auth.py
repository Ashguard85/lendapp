def hash_password(password: str):
    return password  # KEIN HASH (nur Debug)

def verify_password(plain_password: str, hashed_password: str):
    return plain_password == hashed_password
