// CloudFront Function (viewer-request) for murraysbennett.com.
// The distribution reads the S3 REST endpoint through Origin Access Control, so
// the origin returns the object at the literal key and `DefaultRootObject`
// covers only `/`. Without this rewrite, `/demos/workshops/` asks S3 for the key
// `demos/workshops/`, which does not exist; with OAC and no `s3:ListBucket`
// grant the answer is 403, not 404.
//
// Anything whose last path segment contains a dot is left alone, so
// `/tools.html` and every asset URL pass through untouched. Attached to
// distribution EEM313Y5S27PB; see README.md in this directory.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri = uri + 'index.html';
  } else if (!uri.split('/').pop().includes('.')) {
    request.uri = uri + '/index.html';
  }
  return request;
}
