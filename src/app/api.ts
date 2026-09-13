import { CraftHttpClient, craftGen, craftUntilSettled, response } from '@craft-ts/core';
import type {
  CreatePresentationInput,
  PresentationDocument,
  PresentationImageUpload,
  PresentationImageUploadInput,
  PresentationSummary,
  PresentationStoreInput,
  PresentationDemoWorkspace,
  PresentationDemoWorkspaceConfig,
  PresentationDemoWorkspaceId,
  PresentationDemoWorkspaceProcessStatus,
} from '../shared/presentation';

export type {
  CreatePresentationInput,
  PresentationDocument,
  PresentationSection,
  PresentationSequence,
  PresentationImageUpload,
  PresentationImageUploadInput,
  PresentationSummary,
  PresentationStoreInput,
  PresentationDemoWorkspace,
  PresentationDemoWorkspaceConfig,
  PresentationDemoWorkspaceId,
  PresentationDemoWorkspaceProcessStatus,
} from '../shared/presentation';

export const listPresentations = craftGen(function* () {
  return yield* CraftHttpClient.get(({ response }) => ({
    url: '/api/presentations',
    success: response<readonly PresentationSummary[]>(),
  }));
});

export function* loadPresentation(id: string) {
  const request = yield* CraftHttpClient.get(() => ({
    url: `/api/presentations/${id}`,
    success: response<PresentationDocument>(),
  }));
  return request as unknown as PresentationDocument;
}

export function* loadDemoWorkspace(id: PresentationDemoWorkspaceId) {
  const request = yield* CraftHttpClient.get(() => ({
    url: `/api/demo-workspaces/${id}`,
    success: response<PresentationDemoWorkspace>(),
  }));
  return request as unknown as PresentationDemoWorkspace;
}

export function* listDemoWorkspaceConfigs() {
  const request = yield* CraftHttpClient.get(() => ({
    url: '/api/demo-workspaces',
    success: response<readonly PresentationDemoWorkspaceConfig[]>(),
  }));
  return request as unknown as readonly PresentationDemoWorkspaceConfig[];
}

export function* saveDemoWorkspaceConfig(config: PresentationDemoWorkspaceConfig) {
  const request = yield* CraftHttpClient.post(() => ({
    url: '/api/demo-workspaces',
    payload: config,
    success: response<PresentationDemoWorkspaceConfig>(),
  }));
  return request as unknown as PresentationDemoWorkspaceConfig;
}

export function* loadDemoWorkspaceProcessStatus(id: PresentationDemoWorkspaceId) {
  const request = yield* CraftHttpClient.get(() => ({
    url: `/api/demo-workspaces/${id}/process`,
    success: response<PresentationDemoWorkspaceProcessStatus>(),
  }));
  return request as unknown as PresentationDemoWorkspaceProcessStatus;
}

export function* startDemoWorkspaceProcess(id: PresentationDemoWorkspaceId) {
  const request = yield* CraftHttpClient.post(() => ({
    url: `/api/demo-workspaces/${id}/process`,
    payload: {},
    success: response<PresentationDemoWorkspaceProcessStatus>(),
  }));
  return request as unknown as PresentationDemoWorkspaceProcessStatus;
}

export function* stopDemoWorkspaceProcess(id: PresentationDemoWorkspaceId) {
  const request = yield* craftUntilSettled(
    CraftHttpClient.delete(() => ({
      url: `/api/demo-workspaces/${id}/process`,
      success: response<PresentationDemoWorkspaceProcessStatus>(),
    })),
  );
  return request as unknown as PresentationDemoWorkspaceProcessStatus;
}

export function* executeDemoWorkspaceCommand(id: PresentationDemoWorkspaceId, command: string) {
  const request = yield* CraftHttpClient.post(() => ({
    url: `/api/demo-workspaces/${id}/terminal`,
    payload: { command },
    success: response<PresentationDemoWorkspaceProcessStatus>(),
  }));
  return request as unknown as PresentationDemoWorkspaceProcessStatus;
}

export function* createPresentation(input: CreatePresentationInput) {
  const request = yield* CraftHttpClient.post(() => ({
    url: '/api/presentations',
    payload: input,
    success: response<PresentationDocument>(),
  }));
  return request as unknown as PresentationDocument;
}

export function* savePresentation(id: string, input: PresentationStoreInput) {
  const request = yield* CraftHttpClient.put(() => ({
    url: `/api/presentations/${id}`,
    payload: input,
    success: response<PresentationDocument>(),
  }));
  return request as unknown as PresentationDocument;
}

export function* uploadPresentationImage(id: string, input: PresentationImageUploadInput) {
  // Unlike query/mutation loaders, this caller needs the JSON body before its
  // own loader can update the draft, so explicitly await the HTTP descriptor.
  return yield* craftUntilSettled(
    CraftHttpClient.post(({ response }) => ({
      url: `/api/presentations/${id}/images`,
      payload: input,
      success: response<PresentationImageUpload>(),
    })),
  );
}
