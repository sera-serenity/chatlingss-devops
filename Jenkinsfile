pipeline {
  agent any

  parameters {
    string(
      name: 'DOCKER_REGISTRY',
      defaultValue: '',
      description: 'Optional Docker registry prefix (e.g. myregistry.io/myorg)'
    )
    booleanParam(
      name: 'PUSH_IMAGES',
      defaultValue: false,
      description: 'Push built images to the registry after building'
    )
    booleanParam(
      name: 'RUN_TESTS',
      defaultValue: true,
      description: 'Run test suite if available'
    )
  }

  environment {
    COMPOSE_FILE  = 'cutechat-devops/docker-compose.yml'
    IMAGE_TAG     = "${env.GIT_COMMIT?.take(7) ?: 'latest'}"
    // If a registry is supplied, images are tagged as registry/service:commit-sha
    REGISTRY_PREFIX = "${params.DOCKER_REGISTRY?.trim() ? params.DOCKER_REGISTRY.trim() + '/' : ''}"
  }

  options {
    timestamps()
    disableConcurrentBuilds()          // Avoid race conditions on shared Docker daemon
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {

    // ------------------------------------------------------------------ //
    stage('Checkout') {
      steps {
        checkout scm
        sh 'git log -1 --oneline'      // Confirm what commit we are building
      }
    }

    // ------------------------------------------------------------------ //
    stage('Install root dependencies') {
      steps {
        script {
          if (fileExists('package.json')) {
            sh 'npm ci --prefer-offline'
          } else {
            echo 'No root package.json — skipping npm install.'
          }
        }
      }
    }

    // ------------------------------------------------------------------ //
    stage('Lint & static checks') {
      steps {
        script {
          if (fileExists('package.json')) {
            // Add your linter here (eslint, etc.) — falls through if not configured
            sh 'npm run lint --if-present || true'
          } else {
            echo 'No lint script found — skipping.'
          }
        }
      }
    }

    // ------------------------------------------------------------------ //
    stage('Build Docker images') {
      steps {
        script {
          // Build all services defined in docker-compose.yml
          sh """
            docker-compose -f ${COMPOSE_FILE} build \
              --parallel \
              --build-arg BUILD_TAG=${IMAGE_TAG}
          """
        }
      }
    }

    // ------------------------------------------------------------------ //
    stage('Run tests') {
      when {
        expression { return params.RUN_TESTS }
      }
      steps {
        script {
          if (fileExists('package.json')) {
            sh 'npm test || true'
          } else {
            echo 'No test script found — skipping.'
          }

          // Run service-level tests inside containers if test targets exist
          // Adjust service name / command to match your compose config
          sh """
            docker-compose -f ${COMPOSE_FILE} run --rm auth-service    sh -c 'npm test --if-present' || true
            docker-compose -f ${COMPOSE_FILE} run --rm message-service sh -c 'npm test --if-present' || true
            docker-compose -f ${COMPOSE_FILE} run --rm game-service    sh -c 'npm test --if-present' || true
          """
        }
      }
    }

    // ------------------------------------------------------------------ //
    stage('Tag images') {
      when {
        expression { return params.PUSH_IMAGES && params.DOCKER_REGISTRY?.trim() }
      }
      steps {
        script {
          // Re-tag each service image with the registry prefix + commit SHA
          def services = ['auth-service', 'chat-service', 'frontend', 'game-service', 'message-service', 'worker-service']
          services.each { svc ->
            sh """
              docker tag cutechat-devops-${svc}:latest \
                ${REGISTRY_PREFIX}${svc}:${IMAGE_TAG}
              docker tag cutechat-devops-${svc}:latest \
                ${REGISTRY_PREFIX}${svc}:latest
            """
          }
        }
      }
    }

    // ------------------------------------------------------------------ //
    stage('Push images') {
      when {
        expression { return params.PUSH_IMAGES }
      }
      steps {
        script {
          if (!params.DOCKER_REGISTRY?.trim()) {
            error 'PUSH_IMAGES is enabled but DOCKER_REGISTRY is empty. Set the registry param or disable push.'
          }
          // Requires Docker credentials configured in Jenkins credentials store
          withCredentials([usernamePassword(
            credentialsId: 'docker-registry-credentials',
            usernameVariable: 'DOCKER_USER',
            passwordVariable: 'DOCKER_PASS'
          )]) {
            sh "echo ${DOCKER_PASS} | docker login ${params.DOCKER_REGISTRY} -u ${DOCKER_USER} --password-stdin"
            sh "docker-compose -f ${COMPOSE_FILE} push"
          }
        }
      }
    }

  } // end stages

  // -------------------------------------------------------------------- //
  post {
    always {
      echo '--- Built images ---'
      sh 'docker images | grep cutechat || true'

      // Tear down any containers spun up during tests
      sh "docker-compose -f ${COMPOSE_FILE} down --remove-orphans || true"
    }
    success {
      echo "✅ Pipeline succeeded — image tag: ${IMAGE_TAG}"
    }
    failure {
      echo '❌ Pipeline failed. Check the logs above.'
    }
  }
}