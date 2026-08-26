class_name HttpApiTransport
extends IApiTransport
## Composition-edge API transport adapter.
##
## Per docs/canonical-backend-api-authority-contract.md, this adapter must
## send the existing session/privileged headers only to their respective
## routes, and must never embed faculty/curriculum-admin secrets in a
## player build. A successful local request is not by itself durable
## authority — only the server's dedicated response/receipt is.
##
## M1-P1 scope: this is a transport seam only. Real request/response
## wiring, retry/backoff, and reconciliation are later migration work; do
## not treat this as an implemented network client yet.

var _http: HTTPRequest
var _config
var _logger

func _init(http_request: HTTPRequest, config, logger) -> void:
	_http = http_request
	_config = config
	_logger = logger

func request(method: String, path: String, headers: Dictionary = {}, body: Variant = null) -> Dictionary:
	_logger.debug("http_api_transport", "request() stub called: %s %s" % [method, path])
	return {"status": -1, "error": "not_implemented", "method": method, "path": path}
