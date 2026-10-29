"""MySQL 5.7 production storage; SQLite is explicitly test-only."""
from contextlib import contextmanager
import sqlite3

class Database:
    def __init__(self, config): self.config=config; self.sqlite=bool(config.get('SQLITE_PATH'))
    def connect(self):
        if self.sqlite:
            conn=sqlite3.connect(self.config['SQLITE_PATH'],timeout=30,isolation_level=None); conn.row_factory=sqlite3.Row; return conn
        import pymysql
        conn=pymysql.connect(host=self.config['DB_HOST'],port=int(self.config['DB_PORT']),user=self.config['DB_USER'],password=self.config['DB_PASSWORD'],database=self.config['DB_NAME'],charset='utf8mb4',autocommit=False,cursorclass=pymysql.cursors.DictCursor,connect_timeout=8)
        try:
            cur=conn.cursor(); cur.execute('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ'); cur.close(); conn.commit()
        except BaseException:
            conn.close(); raise
        return conn
    def execute(self,conn,sql,args=()):
        cur=conn.cursor(); cur.execute(sql.replace('%s','?') if self.sqlite else sql,args); return cur
    @contextmanager
    def transaction(self,write=False):
        conn=self.connect()
        try:
            if self.sqlite: conn.execute('BEGIN IMMEDIATE' if write else 'BEGIN')
            else: conn.begin()
            yield conn; conn.commit()
        except BaseException: conn.rollback(); raise
        finally: conn.close()
    def migrate(self):
        suffix='' if self.sqlite else ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin'
        statements=[
            'CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username VARCHAR(128) NOT NULL, password_hash VARCHAR(512) NOT NULL, token_hash VARCHAR(64), auth_version INTEGER NOT NULL DEFAULT 1)',
            'CREATE TABLE IF NOT EXISTS profiles (user_id INTEGER PRIMARY KEY, revision BIGINT NOT NULL, document LONGTEXT NOT NULL)',
            'CREATE TABLE IF NOT EXISTS records (user_id INTEGER NOT NULL, kind VARCHAR(32) NOT NULL, record_id VARCHAR(191) NOT NULL, position INTEGER NOT NULL, payload LONGTEXT NOT NULL, PRIMARY KEY(user_id,kind,record_id))',
            'CREATE TABLE IF NOT EXISTS receipts (user_id INTEGER NOT NULL, request_id VARCHAR(128) NOT NULL, fingerprint VARCHAR(64) NOT NULL, response LONGTEXT NOT NULL, PRIMARY KEY(user_id,request_id))',
            'CREATE TABLE IF NOT EXISTS changelog (user_id INTEGER NOT NULL, revision BIGINT NOT NULL, action VARCHAR(64) NOT NULL, created_at VARCHAR(40) NOT NULL, PRIMARY KEY(user_id,revision))',
            'CREATE TABLE IF NOT EXISTS snapshots (user_id INTEGER NOT NULL, revision BIGINT NOT NULL, document LONGTEXT NOT NULL, created_at VARCHAR(40) NOT NULL, PRIMARY KEY(user_id,revision))',
            'CREATE TABLE IF NOT EXISTS attachments (id VARCHAR(80) PRIMARY KEY, user_id INTEGER NOT NULL, content_type VARCHAR(40) NOT NULL, size BIGINT NOT NULL, created_at VARCHAR(40) NOT NULL)']
        with self.transaction(True) as conn:
            for sql in statements: self.execute(conn,sql+suffix)
