```mermaid
graph TD
    subgraph Workflow Triggers
        direction LR
        TR_PUSH_MAIN[Push to main]
        TR_PUSH_TAG[Push tag v*]
        TR_RELEASE[Release created]
        TR_SCHEDULE[Schedule: 0 2 * * 0]
        TR_DISPATCH[Workflow Dispatch Inputs]
    end

    subgraph "Docker Builds (Staging - GHCR)"
        J_BUILD_DOCKER_VNC[build_docker_vnc<br>(Build VNC Image)]
        J_BUILD_DOCKER_MCP[build_docker_mcp<br>(Build MCP Image)]
    end

    subgraph "NPM GitHub Pipeline (Staging)"
        J_TEST_E2E[test_e2e<br>(NPM E2E Tests)]
        J_TEST_CONTAINERS[test_containers<br>(NPM Container Tests)]
        J_BUILD_GH_NPM[build_and_publish_github_npm<br>(Build & Publish to GitHub NPM)]
    end

    subgraph "NPMJS.org Pipeline (Production)"
        J_PREP_NPMJS[prepare_and_dry_run_npmjs<br>(Prepare & Dry-Run NPMJS.org)]
        J_PUB_NPMJS[publish_to_npmjs_org<br>(Publish to NPMJS.org)]
    end

    subgraph "Screenshots"
        J_SCREENSHOTS[take_screenshots<br>(Generate & Publish Screenshots)]
    end

    subgraph "Maintenance"
        J_CLEANUP[cleanup_old_versions<br>(Cleanup Old Package Versions)]
    end

    %% Defining execution paths based on common triggers - actual execution depends on specific 'if' conditions per job

    TR_DISPATCH -- "inputs.build_docker_images" --> J_BUILD_DOCKER_VNC
    TR_DISPATCH -- "inputs.build_docker_images" --> J_BUILD_DOCKER_MCP
    TR_PUSH_MAIN ----> J_BUILD_DOCKER_VNC
    TR_PUSH_MAIN ----> J_BUILD_DOCKER_MCP
    TR_PUSH_TAG ----> J_BUILD_DOCKER_VNC
    TR_PUSH_TAG ----> J_BUILD_DOCKER_MCP

    TR_DISPATCH -- "inputs.run_npm_github_pipeline" --> J_TEST_E2E
    TR_DISPATCH -- "inputs.run_npm_github_pipeline" --> J_TEST_CONTAINERS
    TR_PUSH_MAIN ----> J_TEST_E2E
    TR_PUSH_MAIN ----> J_TEST_CONTAINERS
    TR_PUSH_TAG ----> J_TEST_E2E
    TR_PUSH_TAG ----> J_TEST_CONTAINERS
    TR_RELEASE ----> J_TEST_E2E
    TR_RELEASE ----> J_TEST_CONTAINERS

    J_TEST_E2E --> J_BUILD_GH_NPM
    J_TEST_CONTAINERS --> J_BUILD_GH_NPM

    TR_DISPATCH -- "inputs.run_npmjs_pipeline" --> J_PREP_NPMJS
    TR_PUSH_TAG ----> J_PREP_NPMJS
    J_PREP_NPMJS -- "dispatch inputs.confirm_npmjs_publish" --> J_PUB_NPMJS

    TR_DISPATCH -- "inputs.run_screenshots_pipeline" --> J_SCREENSHOTS
    TR_PUSH_MAIN ----> J_SCREENSHOTS
    TR_PUSH_TAG ----> J_SCREENSHOTS
    TR_RELEASE ----> J_SCREENSHOTS

    TR_SCHEDULE ----> J_CLEANUP
    TR_DISPATCH -- "inputs.run_cleanup_job" --> J_CLEANUP

    %% Style Adjustments
    classDef job fill:#ececff,stroke:#999,stroke-width:2px,color:#000
    classDef trigger fill:#e6ffe6,stroke:#999,stroke-width:1px,color:#000
    class J_BUILD_DOCKER_VNC,J_BUILD_DOCKER_MCP,J_TEST_E2E,J_TEST_CONTAINERS,J_BUILD_GH_NPM,J_PREP_NPMJS,J_PUB_NPMJS,J_SCREENSHOTS,J_CLEANUP job
    class TR_PUSH_MAIN,TR_PUSH_TAG,TR_RELEASE,TR_SCHEDULE,TR_DISPATCH trigger
```
