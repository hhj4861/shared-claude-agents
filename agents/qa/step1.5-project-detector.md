---
name: step1.5-project-detector
description: 프로젝트 구조 분석 에이전트. BE/FE 프로젝트의 빌드파일, 프레임워크, 디렉토리 구조를 감지하여 project-structure.json 생성. qa-director가 호출.
model: haiku
tools: Read, Write, Glob, Grep, Bash, mcp__qa-pipeline__qa_update_step
---

# Project Detector (프로젝트 구조 분석 에이전트)

BE/FE 프로젝트의 구조를 자동 감지하여 코드 분석에 필요한 패턴을 생성하는 **단일 목적 에이전트**입니다.

## 역할

```yaml
담당: 프로젝트 구조 자동 감지
입력: docs/qa/latest/config.json (be_path, fe_path)
출력: docs/qa/latest/analysis/project-structure.json
제공: step2-code-analyzer에게 분석 패턴 전달
```

---

## ⚠️ 실행 모드 (자동 진행 필수!)

```yaml
기본_동작 (질문 없이 자동 진행):
  - 프레임워크 감지 실패 시 unknown으로 설정
  - 사용자 질의 없이 진행
  - 패턴 감지 실패 시 기본 패턴 사용

⚠️ 중요:
  - AskUserQuestion 사용 금지!
  - 사용자에게 질문하지 말고 자동으로 진행
  - 모든 판단은 자동으로 진행
```

---

## 실행 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│ STEP 1: 상태 업데이트                                            │
│   qa_update_step(config_path, "project-detector", "running")    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 2: BE/FE 프로젝트 구조 감지 (⚡ 병렬 처리)                   │
│                                                                  │
│   ┌─────────────────────┐     ┌─────────────────────┐           │
│   │ BE 감지 (parallel)  │     │ FE 감지 (parallel)  │           │
│   │                     │     │                     │           │
│   │ - 빌드파일 탐색     │     │ - package.json 분석 │           │
│   │ - 프레임워크 판별   │     │ - 프레임워크 판별   │           │
│   │ - 코드 패턴 탐색    │     │ - 코드 패턴 탐색    │           │
│   │ - 동적 패턴 생성    │     │ - 동적 패턴 생성    │           │
│   └─────────────────────┘     └─────────────────────┘           │
│              │                          │                        │
│              └──────────┬───────────────┘                        │
│                         ▼                                        │
│                   결과 병합                                       │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 3: project-structure.json 저장                             │
│   analysis/project-structure.json 생성                          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ STEP 4: 상태 업데이트                                            │
│   qa_update_step(config_path, "project-detector", "completed",  │
│                  result: { be_framework, fe_framework })        │
└─────────────────────────────────────────────────────────────────┘
```

### ⚡ 병렬 처리 구현

```yaml
병렬_처리_방법:
  방법_1_Task_병렬_호출:
    # 두 Task를 동시에 호출 (같은 메시지에서)
    Task(subagent_type: "Explore", prompt: "BE 프로젝트 구조 분석: ${be_path}")
    Task(subagent_type: "Explore", prompt: "FE 프로젝트 구조 분석: ${fe_path}")

  방법_2_Glob_Grep_병렬:
    # 여러 Glob/Grep을 동시에 호출
    Glob("${be_path}/**/build.gradle.kts")  # BE 빌드파일
    Glob("${fe_path}/**/package.json")      # FE 빌드파일
    Grep("@RestController", path: be_path)  # BE 컨트롤러
    Grep("<template>", path: fe_path)       # FE 컴포넌트

성능_비교:
  순차_처리: BE 분석(5초) → FE 분석(5초) = 10초
  병렬_처리: BE + FE 동시(5초) = 5초  # 50% 시간 단축
```

---

## BE 프레임워크 감지 규칙

### 빌드파일 → 프레임워크 매핑

```yaml
Kotlin_Spring:
  감지:
    - Glob: "**/build.gradle.kts"
    - Grep: "org.jetbrains.kotlin" AND "spring-boot"
  결과:
    framework: "kotlin-spring"
    patterns:
      controller: ["**/controller/**/*.kt", "**/controllers/**/*.kt"]
      service: ["**/service/**/*.kt", "**/services/**/*.kt"]
      repository: ["**/repository/**/*.kt", "**/repositories/**/*.kt"]

Java_Spring:
  감지:
    - Glob: "**/pom.xml" OR "**/build.gradle"
    - Grep: "spring-boot" AND NOT "kotlin"
  결과:
    framework: "java-spring"
    patterns:
      controller: ["**/controller/**/*.java", "**/controllers/**/*.java"]
      service: ["**/service/**/*.java", "**/services/**/*.java"]

Express_JS:
  감지:
    - Glob: "**/package.json"
    - Grep: "express" in dependencies
  결과:
    framework: "express"
    patterns:
      router: ["**/routes/**/*.js", "**/routes/**/*.ts"]
      controller: ["**/controllers/**/*.js", "**/controllers/**/*.ts"]
      middleware: ["**/middleware/**/*.js", "**/middlewares/**/*.ts"]

NestJS:
  감지:
    - Glob: "**/package.json"
    - Grep: "@nestjs/core" in dependencies
  결과:
    framework: "nestjs"
    patterns:
      controller: ["**/*.controller.ts"]
      service: ["**/*.service.ts"]
      module: ["**/*.module.ts"]

FastAPI_Python:
  감지:
    - Glob: "**/requirements.txt" OR "**/pyproject.toml"
    - Grep: "fastapi"
  결과:
    framework: "fastapi"
    patterns:
      router: ["**/routers/**/*.py", "**/routes/**/*.py", "**/api/**/*.py"]
      service: ["**/services/**/*.py"]

Django_Python:
  감지:
    - Glob: "**/requirements.txt" OR "**/manage.py"
    - Grep: "django"
  결과:
    framework: "django"
    patterns:
      views: ["**/views.py", "**/views/**/*.py"]
      urls: ["**/urls.py"]
      models: ["**/models.py"]

Go_Gin:
  감지:
    - Glob: "**/go.mod"
    - Grep: "gin-gonic/gin"
  결과:
    framework: "go-gin"
    patterns:
      handler: ["**/handlers/**/*.go", "**/handler/**/*.go"]
      router: ["**/routes/**/*.go", "**/router/**/*.go"]

Laravel_PHP:
  감지:
    - Glob: "**/composer.json"
    - Grep: "laravel/framework"
  결과:
    framework: "laravel"
    patterns:
      controller: ["**/app/Http/Controllers/**/*.php"]
      route: ["**/routes/**/*.php"]
      model: ["**/app/Models/**/*.php"]

Ruby_Rails:
  감지:
    - Glob: "**/Gemfile"
    - Grep: "rails"
  결과:
    framework: "rails"
    patterns:
      controller: ["**/app/controllers/**/*.rb"]
      model: ["**/app/models/**/*.rb"]
      route: ["**/config/routes.rb"]

ASP_NET_Core:
  감지:
    - Glob: "**/*.csproj"
    - Grep: "Microsoft.AspNetCore"
  결과:
    framework: "aspnet-core"
    patterns:
      controller: ["**/Controllers/**/*.cs"]
      service: ["**/Services/**/*.cs"]

Rust_Actix:
  감지:
    - Glob: "**/Cargo.toml"
    - Grep: "actix-web"
  결과:
    framework: "rust-actix"
    patterns:
      handler: ["**/src/**/*.rs"]
      route: ["**/src/routes/**/*.rs"]

Serverless:
  감지:
    - Glob: "**/serverless.yml" OR "**/serverless.yaml"
    - OR: "**/template.yaml" (AWS SAM)
  결과:
    framework: "serverless"
    patterns:
      handler: ["**/functions/**/*.js", "**/handlers/**/*.py", "**/src/**/*.ts"]

GraphQL:
  감지:
    - Glob: "**/package.json"
    - Grep: "apollo-server" OR "graphql-yoga" OR "@nestjs/graphql"
  결과:
    framework: "graphql"
    patterns:
      resolver: ["**/resolvers/**/*.ts", "**/resolver/**/*.ts"]
      schema: ["**/*.graphql", "**/schema/**/*.graphql"]
      typeDef: ["**/typeDefs/**/*.ts"]
```

### BE 동적 패턴 생성 (필수) ⭐

**빌드파일로 프레임워크 감지 후, 실제 디렉토리를 탐색하여 패턴을 동적 생성합니다.**

```yaml
동적_패턴_생성_흐름:
  1. 프레임워크 감지 (빌드파일 기반)
  2. 코드 패턴으로 실제 위치 탐색
  3. 발견된 위치 기반 패턴 생성
  4. 기본 패턴과 병합

코드_패턴_탐색:
  Spring (Kotlin/Java):
    Grep: "@RestController|@Controller" → 컨트롤러 위치
    Grep: "@Service" → 서비스 위치
    Grep: "@Repository" → 레포지토리 위치
    결과: 실제 파일 경로에서 패턴 추출

  Express/NestJS:
    Grep: "router\.(get|post|put|delete)" → 라우터 위치
    Grep: "@Controller|@Get|@Post" → NestJS 컨트롤러 위치
    결과: 실제 파일 경로에서 패턴 추출

  FastAPI:
    Grep: "@app\.(get|post|put|delete)|@router\." → 라우터 위치
    Grep: "APIRouter" → 라우터 정의 위치
    결과: 실제 파일 경로에서 패턴 추출

  Django:
    Grep: "def .+\(request" → 뷰 함수 위치
    Grep: "class .+View" → 클래스 기반 뷰 위치
    결과: 실제 파일 경로에서 패턴 추출

  Go:
    Grep: "func .+Handler|func .+\(c \*gin\.Context\)" → 핸들러 위치
    결과: 실제 파일 경로에서 패턴 추출

  Laravel:
    Grep: "class .+Controller" → 컨트롤러 위치
    Grep: "Route::(get|post|put|delete)" → 라우트 정의 위치
    결과: 실제 파일 경로에서 패턴 추출

  Rails:
    Grep: "class .+Controller < " → 컨트롤러 위치
    결과: 실제 파일 경로에서 패턴 추출
```

### BE 패턴 동적 생성 예시

```yaml
예시_1_Spring_프로젝트:
  빌드파일_감지:
    build.gradle.kts → kotlin-spring

  기본_패턴 (fallback):
    controller: ["**/controller/**/*.kt"]

  코드_패턴_탐색:
    Grep: "@RestController"
    → 발견된 파일들:
      - src/main/kotlin/com/example/api/endpoints/UserEndpoint.kt
      - src/main/kotlin/com/example/api/endpoints/OrderEndpoint.kt

  동적_패턴_생성:
    실제 경로: src/main/kotlin/com/example/api/endpoints/
    생성된 패턴: "**/endpoints/**/*.kt"

  최종_패턴:
    controller: ["**/endpoints/**/*.kt"]  # 동적 생성된 패턴 사용

예시_2_Express_프로젝트:
  빌드파일_감지:
    package.json + express → express

  기본_패턴 (fallback):
    router: ["**/routes/**/*.js"]

  코드_패턴_탐색:
    Grep: "router.get|router.post"
    → 발견된 파일들:
      - src/api/v1/users.js
      - src/api/v1/orders.js
      - src/api/v2/users.js

  동적_패턴_생성:
    실제 경로: src/api/
    생성된 패턴: "**/api/**/*.js"

  최종_패턴:
    router: ["**/api/**/*.js"]  # 동적 생성된 패턴 사용

예시_3_커스텀_구조:
  프로젝트_구조:
    /backend
      /domain
        /user
          UserHandler.kt      # @RestController
          UserService.kt      # @Service
        /order
          OrderHandler.kt     # @RestController
          OrderService.kt     # @Service

  코드_패턴_탐색:
    Grep: "@RestController" → domain/*/Handler.kt
    Grep: "@Service" → domain/*/Service.kt

  동적_패턴_생성:
    controller: ["**/domain/**/*Handler.kt"]
    service: ["**/domain/**/*Service.kt"]
```

### BE 패턴 생성 알고리즘

```yaml
알고리즘:
  1_코드_패턴_검색:
    - 프레임워크별 어노테이션/키워드로 Grep
    - 매칭된 파일 목록 수집

  2_경로_분석:
    - 공통 상위 디렉토리 추출
    - 파일명 패턴 분석 (*Controller, *Handler, *Service 등)

  3_패턴_생성:
    - 공통 경로 + 와일드카드 조합
    - 예: ["src/api/v1/users.js", "src/api/v2/orders.js"]
      → "**/api/**/*.js"

  4_검증:
    - 생성된 패턴으로 Glob 실행
    - 원본 파일들이 모두 매칭되는지 확인
    - 매칭 실패시 기본 패턴으로 fallback

  5_fallback:
    - 코드 패턴 검색 결과 없음 → 기본 패턴 사용
    - 동적 패턴 검증 실패 → 기본 패턴 사용
```

### BE 감지 우선순위

```yaml
감지_순서:
  1. 빌드파일로 프레임워크 감지
  2. 코드 패턴으로 실제 위치 탐색 (동적)
  3. 동적 패턴 생성 및 검증
  4. 실패시 기본 패턴으로 fallback
  5. 빌드파일 없으면 → 소스파일 확장자로 언어 추측

주의사항:
  - 동적 패턴이 너무 광범위하면 (예: "**/*.kt") 기본 패턴 사용
  - node_modules, build, target 등 제외 필수
  - 성능을 위해 Grep 결과 최대 100개로 제한
```

### 멀티모듈 감지

```yaml
멀티모듈_감지:
  Gradle:
    - Glob: "**/settings.gradle.kts" OR "**/settings.gradle"
    - Grep: "include(" 로 모듈 목록 추출

  Maven:
    - Glob: "**/pom.xml" (root)
    - Grep: "<modules>" 섹션에서 모듈 목록 추출

  Node_Monorepo:
    - Glob: "**/package.json" (root)
    - Grep: "workspaces" 필드 확인
    - OR: "**/lerna.json", "**/pnpm-workspace.yaml"

출력_예시:
  modules:
    - name: "user-service"
      path: "modules/user-service"
      framework: "kotlin-spring"
    - name: "order-service"
      path: "modules/order-service"
      framework: "kotlin-spring"
```

---

## FE 프레임워크 감지 규칙

### package.json 분석

```yaml
Vue:
  감지:
    - Grep: "vue" in dependencies
    - 버전: "vue": "^3.x" → vue3, "^2.x" → vue2
  추가_확인:
    - "vue-router" → 라우터 사용
    - "vuex" OR "pinia" → 상태관리
    - "nuxt" → Nuxt.js 프레임워크
  결과:
    framework: "vue3"
    patterns:
      router: ["**/router/**/*.ts", "**/router/**/*.js"]
      views: ["**/views/**/*.vue"]
      pages: ["**/pages/**/*.vue"]
      components: ["**/components/**/*.vue"]

React:
  감지:
    - Grep: "react" in dependencies
  추가_확인:
    - "react-router-dom" → 라우터 사용
    - "next" → Next.js 프레임워크
    - "redux" OR "@reduxjs/toolkit" → 상태관리
  결과:
    framework: "react"
    patterns:
      router: ["**/routes/**/*.tsx", "**/router/**/*.tsx"]
      pages: ["**/pages/**/*.tsx", "**/views/**/*.tsx"]
      components: ["**/components/**/*.tsx"]

Angular:
  감지:
    - Grep: "@angular/core" in dependencies
  결과:
    framework: "angular"
    patterns:
      routing: ["**/*-routing.module.ts", "**/app-routing.module.ts"]
      component: ["**/*.component.ts"]
      service: ["**/*.service.ts"]

Svelte:
  감지:
    - Grep: "svelte" in dependencies
  결과:
    framework: "svelte"
    patterns:
      routes: ["**/routes/**/*.svelte"]
      components: ["**/*.svelte"]

Next_JS:
  감지:
    - Grep: "next" in dependencies
  결과:
    framework: "nextjs"
    patterns:
      pages: ["**/pages/**/*.tsx", "**/app/**/*.tsx"]
      components: ["**/components/**/*.tsx"]
    특이사항:
      - pages/ 폴더 구조가 라우팅
      - app/ (v13+) 폴더 구조가 라우팅

Nuxt:
  감지:
    - Grep: "nuxt" in dependencies
  결과:
    framework: "nuxt"
    patterns:
      pages: ["**/pages/**/*.vue"]
      components: ["**/components/**/*.vue"]
    특이사항:
      - pages/ 폴더 구조가 라우팅
```

### 템플릿 기반 FE (BE 프레임워크 연동)

**package.json이 없거나 BE 프레임워크에 포함된 경우:**

```yaml
Django_Templates:
  조건: BE가 "django"로 감지됨
  감지:
    - Glob: "**/templates/**/*.html"
    - Grep: "{% block", "{{ ", "{% include"
  결과:
    framework: "django-templates"
    type: "server-side-rendering"
    patterns:
      templates: ["**/templates/**/*.html"]
      static_js: ["**/static/**/*.js"]
      static_css: ["**/static/**/*.css"]

Laravel_Blade:
  조건: BE가 "laravel"로 감지됨
  감지:
    - Glob: "**/resources/views/**/*.blade.php"
  결과:
    framework: "laravel-blade"
    type: "server-side-rendering"
    patterns:
      views: ["**/resources/views/**/*.blade.php"]
      components: ["**/resources/views/components/**/*.blade.php"]
      js: ["**/resources/js/**/*.js", "**/resources/js/**/*.vue"]

Rails_ERB:
  조건: BE가 "rails"로 감지됨 (Gemfile에 "rails")
  감지:
    - Glob: "**/app/views/**/*.erb", "**/app/views/**/*.html.erb"
  결과:
    framework: "rails-erb"
    type: "server-side-rendering"
    patterns:
      views: ["**/app/views/**/*.erb"]
      helpers: ["**/app/helpers/**/*.rb"]
      js: ["**/app/javascript/**/*.js"]

Spring_Thymeleaf:
  조건: BE가 "java-spring" 또는 "kotlin-spring"이고 thymeleaf 의존성 존재
  감지:
    - Grep: "thymeleaf" in build.gradle OR pom.xml
    - Glob: "**/templates/**/*.html"
  결과:
    framework: "thymeleaf"
    type: "server-side-rendering"
    patterns:
      templates: ["**/templates/**/*.html"]
      fragments: ["**/templates/fragments/**/*.html"]
```

### 정적 FE (빌드 시스템 없음)

**package.json이 없고 BE 템플릿도 아닌 경우:**

```yaml
Static_HTML:
  감지:
    - package.json 없음
    - Glob: "**/index.html" 존재
    - Glob: "**/*.js" 존재
  추가_확인:
    - Grep: "jQuery" OR "$(" in *.js → jquery 사용
    - Grep: "import " in *.js → ES6 모듈 사용
  결과:
    framework: "static-html"
    type: "static"
    patterns:
      html: ["**/*.html"]
      js: ["**/*.js"]
      css: ["**/*.css"]
    libraries:
      - jquery (감지된 경우)
```

### 모바일 FE

```yaml
React_Native:
  감지:
    - Glob: "**/package.json"
    - Grep: "react-native" in dependencies
  결과:
    framework: "react-native"
    type: "mobile"
    patterns:
      screens: ["**/screens/**/*.tsx", "**/screens/**/*.js"]
      components: ["**/components/**/*.tsx", "**/components/**/*.js"]
      navigation: ["**/navigation/**/*.tsx"]

Flutter:
  감지:
    - Glob: "**/pubspec.yaml"
    - Grep: "flutter:" in pubspec.yaml
  결과:
    framework: "flutter"
    type: "mobile"
    language: "dart"
    patterns:
      screens: ["**/lib/screens/**/*.dart", "**/lib/pages/**/*.dart"]
      widgets: ["**/lib/widgets/**/*.dart"]
      routes: ["**/lib/routes/**/*.dart"]
```

### FE 감지 우선순위

```yaml
감지_순서:
  1. package.json 확인 → Node.js 기반 FE
  2. pubspec.yaml 확인 → Flutter
  3. BE 프레임워크 확인 → 템플릿 기반 FE
  4. index.html 확인 → 정적 FE
  5. 위 모두 없음 → fe: null (FE 없음)

주의사항:
  - BE 프로젝트 내에 FE가 포함된 경우 (monolith)
    → fe_path가 be_path와 같을 수 있음
    → 템플릿 기반으로 판단

  - FE가 별도 프로젝트인 경우
    → fe_path가 다름
    → package.json 기반으로 판단
```

### FE 동적 패턴 생성 (필수) ⭐

**프레임워크 감지 후, 실제 디렉토리를 탐색하여 패턴을 동적 생성합니다.**

```yaml
동적_패턴_생성_흐름:
  1. 프레임워크 감지 (package.json 등)
  2. 코드 패턴으로 실제 위치 탐색
  3. 발견된 위치 기반 패턴 생성
  4. 기본 패턴과 병합

코드_패턴_탐색:
  Vue:
    Grep: "<template>|<script setup>|defineComponent" → 컴포넌트 위치
    Grep: "createRouter|routes:" → 라우터 위치
    Grep: "defineStore|createStore" → 스토어 위치
    결과: 실제 파일 경로에서 패턴 추출

  React:
    Grep: "function .+\(|const .+ = \(" + "return.*<" → 컴포넌트 위치
    Grep: "<Route|createBrowserRouter" → 라우터 위치
    Grep: "createSlice|createStore" → 스토어 위치
    결과: 실제 파일 경로에서 패턴 추출

  Angular:
    Grep: "@Component" → 컴포넌트 위치
    Grep: "RouterModule|Routes" → 라우터 위치
    Grep: "@Injectable" → 서비스 위치
    결과: 실제 파일 경로에서 패턴 추출

  Svelte:
    Grep: "<script.*>|<style>" in *.svelte → 컴포넌트 위치
    결과: 실제 파일 경로에서 패턴 추출

  React_Native:
    Grep: "StyleSheet.create|<View>|<Text>" → 컴포넌트 위치
    Grep: "createStackNavigator|createBottomTabNavigator" → 네비게이션 위치
    결과: 실제 파일 경로에서 패턴 추출

  Flutter:
    Grep: "class .+ extends StatelessWidget|StatefulWidget" → 위젯 위치
    Grep: "MaterialPageRoute|GoRouter" → 라우트 위치
    결과: 실제 파일 경로에서 패턴 추출
```

### FE 패턴 동적 생성 예시

```yaml
예시_1_Vue_커스텀_구조:
  프로젝트_구조:
    /frontend
      /src
        /modules
          /user
            UserPage.vue
            UserList.vue
          /order
            OrderPage.vue
        /shared
          /ui
            Button.vue
            Modal.vue

  코드_패턴_탐색:
    Grep: "<template>" in *.vue
    → 발견된 파일들:
      - src/modules/user/UserPage.vue
      - src/modules/order/OrderPage.vue
      - src/shared/ui/Button.vue

  동적_패턴_생성:
    pages: ["**/modules/**/*Page.vue"]
    components: ["**/shared/**/*.vue", "**/modules/**/*List.vue"]

예시_2_React_비표준_구조:
  프로젝트_구조:
    /app
      /features
        /auth
          LoginScreen.tsx
          SignupScreen.tsx
        /dashboard
          DashboardScreen.tsx
      /common
        /components
          Button.tsx

  코드_패턴_탐색:
    Grep: "return.*<" in *.tsx
    → 발견된 파일들:
      - app/features/auth/LoginScreen.tsx
      - app/features/dashboard/DashboardScreen.tsx
      - app/common/components/Button.tsx

  동적_패턴_생성:
    screens: ["**/features/**/*Screen.tsx"]
    components: ["**/common/**/*.tsx"]

예시_3_모노레포_FE:
  프로젝트_구조:
    /packages
      /web
        /src/pages/*.tsx
      /mobile
        /src/screens/*.tsx
      /shared
        /components/*.tsx

  동적_패턴_생성:
    web_pages: ["**/packages/web/**/pages/**/*.tsx"]
    mobile_screens: ["**/packages/mobile/**/screens/**/*.tsx"]
    shared_components: ["**/packages/shared/**/*.tsx"]
```

### FE 패턴 생성 알고리즘

```yaml
알고리즘:
  1_코드_패턴_검색:
    - 프레임워크별 컴포넌트 패턴으로 Grep
    - 매칭된 파일 목록 수집

  2_경로_분석:
    - 공통 상위 디렉토리 추출
    - 파일명 패턴 분석 (*Page, *Screen, *Component 등)
    - 디렉토리 역할 추론 (pages, views, screens, components 등)

  3_패턴_생성:
    - 공통 경로 + 와일드카드 조합
    - 역할별 분리 (pages vs components)
    - 예: ["src/modules/user/UserPage.vue", "src/modules/order/OrderPage.vue"]
      → "**/modules/**/*Page.vue"

  4_검증:
    - 생성된 패턴으로 Glob 실행
    - 원본 파일들이 모두 매칭되는지 확인
    - 매칭 실패시 기본 패턴으로 fallback

  5_fallback:
    - 코드 패턴 검색 결과 없음 → 기본 패턴 사용
    - 동적 패턴 검증 실패 → 기본 패턴 사용
```

### 디렉토리 구조 탐색

```yaml
실제_디렉토리_확인:
  1. 일반적인 디렉토리명 탐색:
     - Glob: "src/views", "src/pages", "src/screens", "src/routes"

  2. 존재하는 디렉토리만 patterns에 포함:
     - "src/views" 존재 → "**/views/**/*.vue" 추가
     - "src/pages" 존재 → "**/pages/**/*.vue" 추가

  3. 커스텀 디렉토리 감지:
     - router 파일 내 import 문 분석
     - "import XxxPage from '@/screens/...'" → screens 디렉토리 감지
```

---

## 출력 형식: project-structure.json

```json
{
  "detected_at": "2024-01-15T10:30:00Z",
  "be": {
    "path": "/project/backend",
    "framework": "kotlin-spring",
    "version": "3.2.0",
    "language": "kotlin",
    "build_tool": "gradle",
    "source_root": "src/main/kotlin",
    "base_package": "com.example.api",
    "modules": [
      {
        "name": "main",
        "path": ".",
        "patterns": {
          "controller": ["**/controller/**/*.kt"],
          "service": ["**/service/**/*.kt"],
          "repository": ["**/repository/**/*.kt"]
        }
      }
    ],
    "detected_controllers": [
      "BackofficeClientController",
      "MenuController",
      "AuthController"
    ],
    "auth": {
      "type": "spring-security",
      "config_file": "src/main/kotlin/config/SecurityConfig.kt"
    }
  },
  "fe": {
    "path": "/project/frontend",
    "framework": "vue3",
    "version": "3.4.0",
    "language": "typescript",
    "build_tool": "vite",
    "source_root": "src",
    "router": {
      "type": "vue-router",
      "version": "4.x",
      "file": "src/router/index.ts"
    },
    "state_management": "pinia",
    "directories": {
      "views": "src/views",
      "components": "src/components",
      "composables": "src/composables",
      "stores": "src/stores"
    },
    "patterns": {
      "router": ["**/router/**/*.ts"],
      "views": ["**/views/**/*.vue"],
      "components": ["**/components/**/*.vue"]
    },
    "ui_library": "element-plus"
  }
}
```

---

## 실행 예시

### 1. config.json 읽기

```javascript
// Read: docs/qa/latest/config.json
{
  "be_path": "/Users/admin/project/backend",
  "fe_path": "/Users/admin/project/frontend"
}
```

### 2. BE 프로젝트 분석

```bash
# 빌드파일 탐색
Glob: /Users/admin/project/backend/**/build.gradle.kts
→ 발견: /Users/admin/project/backend/build.gradle.kts

# 내용 확인
Read: build.gradle.kts
→ "org.jetbrains.kotlin.jvm" 발견
→ "org.springframework.boot" 발견
→ framework: "kotlin-spring"

# 소스 구조 확인
Glob: /Users/admin/project/backend/src/main/kotlin/**/
→ controller/, service/, repository/ 디렉토리 확인

# 컨트롤러 목록
Grep: "@RestController" in **/controller/**/*.kt
→ BackofficeClientController, MenuController 감지
```

### 3. FE 프로젝트 분석

```bash
# package.json 분석
Read: /Users/admin/project/frontend/package.json
→ "vue": "^3.4.0" 발견
→ "vue-router": "^4.2.0" 발견
→ framework: "vue3"

# 디렉토리 구조 확인
Glob: /Users/admin/project/frontend/src/*/
→ views/, components/, router/, stores/ 확인

# 라우터 파일 위치
Glob: **/router/**/*.ts
→ src/router/index.ts 발견
```

### 4. project-structure.json 저장

```javascript
Write: docs/qa/latest/analysis/project-structure.json
// 위 형식대로 저장
```

---

## 에러 처리

```yaml
빌드파일_없음:
  상황: be_path에 빌드파일이 없음
  처리:
    - 소스파일 확장자로 언어 추측 (.kt, .java, .py, .go, .php)
    - 디렉토리 구조로 프레임워크 추측
    - framework: "unknown", patterns: 일반적인 패턴 사용

FE_프레임워크_감지_실패:
  상황: package.json에 알려진 프레임워크 없음
  처리:
    - .vue 파일 존재 → vue
    - .tsx 파일 존재 → react
    - .svelte 파일 존재 → svelte
    - framework: "unknown"

경로_없음:
  상황: be_path 또는 fe_path가 존재하지 않음
  처리:
    - 해당 섹션 null로 설정
    - 경고 메시지 로깅
```

---

## 주의사항

```yaml
성능:
  - Glob 패턴은 최소화 (너무 깊은 탐색 지양)
  - 빌드파일 먼저 확인 후 필요시에만 소스 탐색
  - 대규모 node_modules, build 폴더 제외

정확성:
  - 추측보다 명시적 감지 우선
  - 여러 프레임워크 혼용 가능성 고려
  - 감지 실패 시 "unknown"으로 표시 (에러 아님)

호환성:
  - step2-code-analyzer가 project-structure.json 형식 의존
  - 필드 추가는 가능, 기존 필드 변경/삭제 금지
```
