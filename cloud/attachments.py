"""Private attachment adapters. OSS SDK is loaded only with complete OSS configuration."""
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit

class LocalStorage:
    backend='local-private'
    def __init__(self,directory,webroot):
        self.directory=Path(directory).resolve()
        if self.directory.is_relative_to(Path(webroot).resolve()): raise ValueError('附件目录必须位于 Web 根目录外')
    def put(self,ident,raw,mime):
        self.directory.mkdir(parents=True,exist_ok=True,mode=0o700)
        target=self.directory/ident
        if target.exists(): return
        fd,temporary=tempfile.mkstemp(prefix='.upload-',dir=self.directory)
        try:
            with os.fdopen(fd,'wb') as handle: handle.write(raw); handle.flush(); os.fsync(handle.fileno())
            os.chmod(temporary,0o600); os.replace(temporary,target)
        finally:
            if os.path.exists(temporary): os.unlink(temporary)

class OSSStorage:
    backend='oss-private'
    def __init__(self,bucket,key_prefix):
        self.bucket=bucket; self.prefix=key_prefix.strip('/')
        if not self.prefix or '..' in self.prefix or '\\' in self.prefix: raise ValueError('OSS KEY_PREFIX 无效')
        try: acl=bucket.get_bucket_acl().acl
        except Exception: raise ValueError('无法验证 OSS Bucket 私有权限') from None
        if acl!='private': raise ValueError('OSS Bucket 必须为 private，拒绝公开 Bucket')
    def key(self,ident):
        if '/' in ident or '\\' in ident or '..' in ident: raise ValueError('附件 ID 无效')
        return self.prefix+'/'+ident
    def put(self,ident,raw,mime):
        try:
            # Check again at each upload so a changed bucket ACL cannot silently expose data.
            if self.bucket.get_bucket_acl().acl!='private': raise ValueError('OSS Bucket 已不是 private，拒绝上传')
            result=self.bucket.put_object(self.key(ident),raw,headers={'x-oss-object-acl':'private','Content-Type':mime,'Cache-Control':'private, no-store'})
            if not 200<=result.status<300: raise OSError('OSS 上传失败')
        except ValueError: raise
        except Exception: raise OSError('OSS 上传失败') from None
    def signed_url(self,ident):
        try:
            if self.bucket.get_bucket_acl().acl!='private': raise ValueError('OSS Bucket 已不是 private，拒绝签名')
            url=self.bucket.sign_url('GET',self.key(ident),300,slash_safe=True)
            if urlsplit(url).scheme!='https': raise ValueError('OSS 签名地址必须为 HTTPS')
            return url
        except ValueError: raise
        except Exception: raise OSError('OSS 签名失败') from None

def create_storage(config,webroot):
    if config.get('ATTACHMENT_STORAGE') is not None: return config['ATTACHMENT_STORAGE']
    keys=('OSS_ENDPOINT','OSS_BUCKET','OSS_ACCESS_KEY_ID','OSS_ACCESS_KEY_SECRET')
    values=[config.get(key) for key in keys]
    if any(values):
        if not all(values): raise ValueError('OSS 配置不完整')
        endpoint=urlsplit(values[0])
        if endpoint.scheme!='https' or not endpoint.hostname or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment: raise ValueError('OSS ENDPOINT 必须为 HTTPS 服务地址')
        try: import oss2
        except ImportError: raise ValueError('OSS 已配置，但尚未安装 cloud/requirements-oss.txt') from None
        auth=oss2.Auth(values[2],values[3]); bucket=oss2.Bucket(auth,values[0],values[1])
        return OSSStorage(bucket,config.get('OSS_KEY_PREFIX') or 'vitals/attachments')
    return LocalStorage(config['ATTACHMENT_DIR'],webroot)
