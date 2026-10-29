import io
import tempfile
import unittest
from unittest.mock import Mock

class OSSAttachments(unittest.TestCase):
    def test_private_acl_required_and_upload_is_private(self):
        from cloud.attachments import OSSStorage
        bucket=Mock(); bucket.get_bucket_acl.return_value.acl='public-read'
        with self.assertRaises(ValueError): OSSStorage(bucket,'health/attachments')
        bucket.get_bucket_acl.return_value.acl='private'; bucket.put_object.return_value.status=200
        storage=OSSStorage(bucket,'health/attachments')
        storage.put('safe.png',b'png','image/png')
        args=bucket.put_object.call_args
        self.assertEqual(args.args,('health/attachments/safe.png',b'png'))
        self.assertEqual(args.kwargs['headers']['x-oss-object-acl'],'private')
        bucket.sign_url.return_value='https://private.invalid/secret-signed'
        self.assertEqual(storage.signed_url('safe.png'),'https://private.invalid/secret-signed')
        bucket.sign_url.assert_called_once_with('GET','health/attachments/safe.png',300,slash_safe=True)
        bucket.put_object.return_value.status=500
        with self.assertRaises(OSError): storage.put('safe.png',b'png','image/png')
    def test_signed_attachment_redirect_requires_authentication(self):
        from cloud.attachments import OSSStorage
        from cloud import create_app
        from PIL import Image
        bucket=Mock(); bucket.get_bucket_acl.return_value.acl='private'; bucket.put_object.return_value.status=200
        bucket.sign_url.return_value='https://private.invalid/signed?signature=temporary'
        with tempfile.TemporaryDirectory() as tmp:
            app=create_app({'TESTING':True,'SECRET_KEY':'test','SQLITE_PATH':tmp+'/db','ATTACHMENT_STORAGE':OSSStorage(bucket,'health')})
            repo=app.extensions['health_repository']; repo.initialize('owner','correct-password'); token=repo.issue_token()
            client=app.test_client(); headers={'Authorization':'Bearer '+token}
            file=io.BytesIO(); Image.new('RGB',(2,2)).save(file,format='PNG'); file.seek(0)
            result=client.post('/api/v1/attachments',headers=headers,data={'file':(file,'a.png')})
            self.assertEqual(result.status_code,200)
            bucket.sign_url.assert_not_called()
            self.assertEqual(client.get(result.json['url']).status_code,401); bucket.sign_url.assert_not_called()
            response=client.get(result.json['url'],headers=headers)
            self.assertEqual(response.status_code,302); self.assertTrue(response.headers['Location'].startswith('https://private.invalid/'))
    def test_changed_bucket_acl_blocks_upload_and_signature(self):
        from cloud.attachments import OSSStorage
        bucket=Mock(); bucket.get_bucket_acl.return_value.acl='private'
        storage=OSSStorage(bucket,'health')
        bucket.get_bucket_acl.return_value.acl='public-read'
        with self.assertRaises(ValueError): storage.put('safe.png',b'png','image/png')
        with self.assertRaises(ValueError): storage.signed_url('safe.png')
        bucket.put_object.assert_not_called(); bucket.sign_url.assert_not_called()
    def test_partial_oss_configuration_refused(self):
        from cloud.attachments import create_storage
        with self.assertRaises(ValueError): create_storage({'OSS_ENDPOINT':'https://example.invalid'},'/tmp/web')
