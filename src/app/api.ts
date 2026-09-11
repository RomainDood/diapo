import { CraftHttpClient, craftUntilSettled, response } from '@craft-ts/core';
import type {
  CreatePresentationInput,
  PresentationDocument,
  PresentationImageUpload,
  PresentationImageUploadInput,
  PresentationSummary,
  PresentationStoreInput,
  PresentationDemoWorkspace,
  PresentationDemoWorkspaceId,
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
  PresentationDemoWorkspaceId,
} from '../shared/presentation';

export function* listPresentations() {
  const request = yield* CraftHttpClient.get(() => ({
    url: '/api/presentations',
    success: response<readonly PresentationSummary[]>(),
  }));
  // CraftHttpClient resolves this tracked request in the query runtime.
  return request as unknown as readonly PresentationSummary[];
}

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
