

Resource & Role API 상세
Resource & Role API 상세
6. Resource 관리 API (Keycloak)
6.1 Resource 목록 조회
GET/api/v2/keycloak/resources
Keycloak에 등록된 Resource 목록을 조회합니다.
Query Parameters
Response 200 OK
참고: deleteYn=true인 리소스는 목록에서 제외됩니다.
clientIdstringNo특정 Client의
Resource만 조회
ParameterTypeRequiredDescription
1{
2"success":true,
3"data":{
4"resources":[
5{
6"resourceId":"f7a4c8d3-9b2e-4f1a-8c7d-3e5f9a2b1c0d",
7"name":"GET /api/v2/dashboard/statistics a1b2c3",
8"displayName":"GET /api/v2/dashboard/statistics",
9"type":"api-endpoint",
10"uris":["/api/v2/dashboard/statistics"],
11"scope":"GET",
12"roles":["admin","viewer"],
13"gatewayApplyYn":true,
14"personalInfoHandleYn":false,
15"locationInfoHandleYn":false,
16"apiActivity":"SELECT_ONE",
17"publicAuthFlag":false,
18"deleteYn":false
19}
20]
21}
22}

6.2 Resource 상세 조회
GET/api/v2/keycloak/resources/{resourceId}?clientId=
{clientId}
특정 Resource의 상세 정보를 조회합니다.
Path Parameters
Query Parameters
Response 200 OK
Response Fields
resourceIdstring (UUID)YesResource 식별자
ParameterTypeRequiredDescription
clientIdstringYesClient 식별자
ParameterTypeRequiredDescription
1{
2"success":true,
3"data":{
4"resourceId":"f7a4c8d3-9b2e-4f1a-8c7d-3e5f9a2b1c0d",
5"name":"GET /api/v2/users a1b2c3",
6"displayName":"GET /api/v2/users",
7"type":"api-endpoint",
8"uris":["/api/v2/users"],
9"scope":"GET",
10"roles":["admin","manager"],
11"gatewayApplyYn":true,
12"personalInfoHandleYn":true,
13"locationInfoHandleYn":false,
14"personalInfoIds":[1,2,3],
15"piIdentifierKeyword":"userId",
16"piIdentifierDescription":"사용자 ID",
17"downloadReason":"업무 처리",
18"listObjectKeyword":"users",
19"apiActivity":"SELECT_ALL",
20"publicAuthFlag":false,
21"deleteYn":false
22}
23}
resourceIdstringResource UUID
FieldTypeDescription

6.3 Resource 등록
POST/api/v2/keycloak/resources
신규 Resource를 등록하고 Keycloak과 동기화합니다.
namestring
Resource 고유 이름 (
"SCOPE
URI UUID"
 형식으로 자동
생성)
displayNamestring
Resource 표시명 (
"SCOPE
URI"
 형식)
typestringResource 타입
urisstring[]Resource URI 목록
scopestringHTTP Method (GET, POST,
PUT, DELETE, PATCH)
rolesstring[]연결된 Role 이름 목록
gatewayApplyYnbooleanGateway 권한 검증 적용 여부
personalInfoHandleYnboolean개인정보 처리 여부
locationInfoHandleYnboolean위치정보 처리 여부
apiActivitystringAPI 활동 유형
publicAuthFlagboolean공개 인증 플래그
deleteYnboolean삭제 여부 (soft delete)

참고:
Resource 이름(name)과 표시명(displayName)은 자동 생성됩니다.
name: "SCOPE URI UUID" 형식 (예: "GET
/api/v2/users a1b2c3")
displayName: "SCOPE URI" 형식 (예: "GET
/api/v2/users")
Scope는 클라이언트 생성 시 GET, POST, PUT, DELETE, PATCH 5개가 미리
생성되어 있습니다.
Request Body
1{
2"uris":["/api/v2/users"],
3"scope":"GET",
4"clientId":"backoffice-admin",
5"type":"api-endpoint",
6"roles":["admin","manager"],
7"gatewayApplyYn":true,
8"publicAuthYn":false,
9"personalInfoHandleYn":true,
10"locationInfoHandleYn":false,
11"personalInfoIds":[1,2,3],
12"apiActivity":"SELECT_ALL",
13"apiRouteId":1
14}
urisstring[]YesResource URI 목록
scopestringYesHTTP Method (GET,
POST, PUT, DELETE,
PATCH)
clientIdstringYesClient 식별자
typestringNoResource 타입 (기본
값: 
"api-
endpoint"
)
FieldTypeRequiredDescription

roles 지정 시 동작: Role이 지정되면 {name}-policy Policy와 
{name}-permission Permission이 자동 생성됩니다.
Response 201 Created
6.4 Resource 일괄 생성
POST/api/v2/keycloak/resources/batch
rolesstring[]No연결할 Role 목록 (지정
시 Policy와 Permission
자동 생성)
gatewayApplyYnbooleanNoGateway 권한 검증 적
용 여부 (기본값: false)
publicAuthYnbooleanNo공개 API 여부 - true면
public-policy 적용 (기
본값: false)
personalInfoHandleYnbooleanNo개인정보 처리 여부
locationInfoHandleYnbooleanNo위치정보 처리 여부
apiActivitystringNoAPI 활동 유형 (예:
SELECT_ALL,
SELECT_ONE, INSERT
등)
apiRouteIdnumberNoAPI Route ID -
Gateway에서 동일 URI
구분용
1{
2"success":true,
3"data":{
4"resourceId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890",
5"name":"GET /api/v2/users a1b2c3",
6"scope":"GET",
7"createdAt":"2025-11-12T12:34:56.789Z"
8}
9}

대상 서비스의 API 목록을 조회하여 Keycloak Resource를 일괄 생성합니다.
Request Body
Response 200 OK
1{
2"clientId":"phoenix2",
3"apiRouteId":103,
4"contextPath":"/api",
5"roles":["admin"],
6"gatewayApplyYn":true,
7"publicAuthYn":false,
8"type":"api-endpoint",
9"personalInfoHandleYn":false,
10"locationInfoHandleYn":false
11}
clientIdstringYesKeycloak 클라이언트
ID
apiRouteIdnumberYesAPI Route ID (대상 서
비스 URI 조회용)
contextPathstringNoContext Path
rolesstring[]No접근 허용할 Role 이름
목록
gatewayApplyYnbooleanNoGateway 적용 여부 (기
본값: false)
publicAuthYnbooleanNo공개 API 여부 (기본값:
false)
FieldTypeRequiredDescription
1{
2"success":true,
3"data":{
4"createdCount":15,
5"skippedCount":2,
6"created":[
7{
8"resourceId":"a1b2c3d4-e5f6-7890-abcd-ef1234567890",
9"name":"GET /api/users a1b2c3",
10"scope":"GET",
11"createdAt":"2025-11-12T12:34:56.789Z"
12}
13],
14"skipped":["INVALID_METHOD /api/health"]
15}

6.5 Resource 수정
PUT/api/v2/keycloak/resources/{resourceId}?clientId=
{clientId}
기존 Resource 정보를 수정합니다.
Side Effect - 메뉴 플래그 자동 재계산:
personalInfoHandleYn 또는 locationInfoHandleYn
값이 변경되면, 해당 리소스가 연결된 모든 메뉴와 상위 메뉴의 플래그가 자동
으로 재계산됩니다.
Path Parameters
Query Parameters
Request Body
참고: apiRouteId는 수정 불가능합니다.
Response 200 OK
16}
resourceIdstring (UUID)YesResource 식별자
ParameterTypeRequiredDescription
clientIdstringYesClient 식별자
ParameterTypeRequiredDescription
1{
2"name":"user-management-v2",
3"displayName":"사용자 관리 v2",
4"type":"api-endpoint",
5"uris":["/api/v2/users","/api/v2/users/*"],
6"scopes":["GET","POST","PUT","DELETE","PATCH"],
7"gatewayApplyYn":true,
8"personalInfoHandleYn":true,
9"locationInfoHandleYn":false
10}
1{
2"success":true,

6.6 Resource 삭제
DELETE/api/v2/keycloak/resources/{resourceId}?clientId=
{clientId}
Resource를 삭제합니다.
동작 방식:
연결된 Permission과 Policy가 삭제됩니다.
Keycloak에서 Resource가 완전히 삭제됩니다 (Hard Delete).
메뉴-리소스 매핑(PortalMenuResource)이 함께 삭제됩니다.
Side Effect: 삭제 전에 해당 리소스가 연결된 메뉴의 플래그가 재계산됩니다.
Path Parameters
Query Parameters
Response 204 No Content
6.7 Resource 일괄 수정
PATCH/api/v2/keycloak/resources
여러 Resource의 속성을 일괄 수정합니다. null이 아닌 필드만 일괄 적용됩니다.
Request Body
3"data":null
4}
resourceIdstring (UUID)YesResource 식별자
ParameterTypeRequiredDescription
clientIdstringYesClient 식별자
ParameterTypeRequiredDescription
1{
2"clientId":"backoffice-admin",
3"targetResourceIds":[
4"f7a4c8d3-9b2e-4f1a-8c7d-3e5f9a2b1c0d",
5"a1b2c3d4-5e6f-7890-abcd-ef1234567890"

Response 200 OK
7. Role 관리 API (Keycloak)
7.1 Role 목록 조회
GET/api/v2/keycloak/roles
6],
7"gatewayApplyYn":true,
8"personalInfoHandleYn":false,
9"locationInfoHandleYn":false,
10"publicAuthFlag":false,
11"type":"api-endpoint",
12"apiActivity":"SELECT_ALL",
13"scope":"GET",
14"roles":["admin","manager"],
15"deleteYn":false
16}
clientIdstringYesClient 식별자
targetResourceIdsstring[]Yes수정할 Resource ID 목
록
gatewayApplyYnbooleanNoGateway 적용 여부
personalInfoHandleYnbooleanNo개인정보 취급 여부
locationInfoHandleYnbooleanNo위치정보 취급 여부
publicAuthFlagbooleanNo공개 API 여부
rolesstring[]No접근 허용 Role 목록
(
null
이면 변경 안
함, 빈 리스트면 Policy
삭제)
deleteYnbooleanNo
삭제 여부 (
true
면
리소스 완전 삭제)
FieldTypeRequiredDescription
1{
2"success":true,
3"data":null
4}

Keycloak에 등록된 Role 목록을 조회합니다.
Query Parameters
Response 200 OK
7.2 Role 생성
POST/api/v2/keycloak/roles
새로운 Role을 생성합니다. Keycloak에 Role을 생성하고, 동일한 이름의 Role-based Policy를 자동
으로 생성합니다.
Request Body
Response 201 Created
clientIdstringNo특정 Client의 Role만
조회
ParameterTypeRequiredDescription
1{
2"success":true,
3"data":{
4"roles":[
5{
6"roleId":"e3f9a7d2-6b4c-4e1a-9d8f-2c5b7e3a9d1f",
7"name":"backoffice_admin",
8"displayName":"백오피스 관리자",
9"description":"백오피스 전체 관리 권한",
10"clientRole":true,
11"clientId":"backoffice-admin",
12"permissionCount":25,
13"createdAt":"2025-01-15T09:00:00.000Z"
14}
15]
16}
17}
1{
2"name":"dashboard_viewer",
3"displayName":"대시보드 조회자",
4"description":"대시보드 조회 전용 권한",
5"clientId":"backoffice-admin"
6}
1{
2"success":true,
3"data":{
4"roleId":"9f1c5e3a-4d7b-4a2e-8c6f-3e7d9a1b5c2f",
5"name":"dashboard_viewer",
6"createdAt":"2025-11-12T12:34:56.789Z"

7.3 Role 수정
PUT/api/v2/keycloak/roles/{roleId}
기존 Role 정보를 수정하고 Keycloak과 동기화합니다.
Path Parameters
Request Body
Response 200 OK
7.4 Role 삭제
DELETE/api/v2/keycloak/roles/{roleId}?clientId={clientId}
Role을 삭제합니다. Role과 연결된 Policy도 함께 삭제됩니다.
Path Parameters
Query Parameters
7}
8}
roleIdstring (UUID)YesRole 식별자
ParameterTypeRequiredDescription
1{
2"displayName":"대시보드 뷰어",
3"description":"대시보드 조회 및 내보내기 권한"
4}
1{
2"success":true,
3"data":{
4"roleId":"9f1c5e3a-4d7b-4a2e-8c6f-3e7d9a1b5c2f",
5"updated":true,
6"keycloakSyncSuccess":true,
7"updatedAt":"2025-11-12T12:34:56.789Z"
8}
9}
roleIdstring (UUID)YesRole 식별자
ParameterTypeRequiredDescription
ParameterTypeRequiredDescription

Response 204 No Content
clientIdstringYesClient 식별자