/* eslint-disable craft-ts/require-effect-adapters, craft-ts/require-primitive-derived-property, craft-ts/require-reactive-template-bindings, craft-ts/no-noninteractive-element-interactions, craft-ts/no-raw-class -- The stage is a keyboard-navigable composite presentation surface; its static visual classes are defined by the studio stylesheet. */
import {
  a,
  aside,
  button,
  craftComponent,
  div,
  forNode,
  heading,
  h,
  ifNode,
  iframe,
  img,
  input,
  matchNode,
  p,
  pre,
  safeResourceUrl,
  safeUrl,
  section,
  span,
  type Input,
} from '@craft-ts/component';
import { assign, num, unit } from '@craft-ts/style';
import type { ColorValue } from '@craft-ts/style';
import {
  CRAFT_TEMPORAL_RUNTIME,
  DestroyRef,
  craftComputed,
  craftMethod,
  craftNodeDirective,
  insertQueryPipe,
  insertReactOnMutation,
  mutation,
  query,
  state,
  type TemporalTaskHandle,
} from '@craft-ts/core';
import { i18n } from '../../../i18n';
import {
  loadDemoWorkspace,
  loadDemoWorkspaceProcessStatus,
  executeDemoWorkspaceCommand,
  loadPresentation,
  startDemoWorkspaceProcess as startDemoWorkspaceProcessRequest,
  stopDemoWorkspaceProcess as stopDemoWorkspaceProcessRequest,
} from '../../api';
import { PRESENTATION_IMAGE_ALLOWED_ORIGINS, PRESENTATION_THEME_GRADIENTS } from '../../../shared/presentation';
import type {
  PresentationDemoWorkspaceFile,
  PresentationDemoWorkspaceId,
  PresentationDemoWorkspaceProcessStatus,
  PresentationSequence,
} from '../../../shared/presentation';
import { highlightCodeTokens } from './code-highlighter';
import { extractPresentationNoteParts } from './presentation-links';
import { presentationGradientVars, presentationProgressVars, presentationSlideVars } from '../../ui/ui.style';
import { threePresentationBackdrop } from './presentation-visual';

function cssColor(value: string): ColorValue {
  return { css: value, dark: value, role: 'none', unproven: '' } as ColorValue;
}

function safePresentationImageUrl(url: string): string {
  if (!url) return '';
  try {
    return safeResourceUrl(url, { allowedOrigins: PRESENTATION_IMAGE_ALLOWED_ORIGINS });
  } catch {
    return '';
  }
}

function safePresentationMediaUrl(url: string): string {
  if (!url) return '';
  try {
    if (url.startsWith('/')) return safeResourceUrl(url, { allowedOrigins: PRESENTATION_IMAGE_ALLOWED_ORIGINS });
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    const safeUrlValue = safeUrl(url);
    return safeResourceUrl(safeUrlValue, { allowedOrigins: [parsed.origin] });
  } catch {
    return '';
  }
}

function safePresentationLinkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return safeUrl(url);
  } catch {
    return '';
  }
}

function safePresentationEmbeddedUrl(url: string): string {
  const safeUrlValue = safePresentationLinkUrl(url);
  if (!safeUrlValue) return '';
  try {
    return safeResourceUrl(safeUrlValue, { allowedOrigins: [new URL(safeUrlValue).origin] });
  } catch {
    return '';
  }
}

const applyPresentationGradient = craftNodeDirective(
  'applyPresentationGradient',
  [],
  ({ element }) => {
    const shell = element as HTMLElement;
    const sync = () => {
      const start = shell.dataset.gradientStart ?? PRESENTATION_THEME_GRADIENTS.aurora.start;
      const middle = shell.dataset.gradientMiddle ?? PRESENTATION_THEME_GRADIENTS.aurora.middle;
      const end = shell.dataset.gradientEnd ?? PRESENTATION_THEME_GRADIENTS.aurora.end;
      const angle = Number(shell.dataset.gradientAngle ?? PRESENTATION_THEME_GRADIENTS.aurora.angle);
      const values = {
        ...assign(presentationGradientVars.start, cssColor(start)),
        ...assign(presentationGradientVars.middle, cssColor(middle)),
        ...assign(presentationGradientVars.end, cssColor(end)),
        ...assign(presentationGradientVars.angle, unit.deg(Number.isFinite(angle) ? angle : PRESENTATION_THEME_GRADIENTS.aurora.angle)),
      };
      Object.entries(values).forEach(([property, value]) => shell.style.setProperty(property, String(value)));
    };
    sync();
    const observer = typeof MutationObserver === 'function' ? new MutationObserver(sync) : undefined;
    observer?.observe(shell, { attributes: true, attributeFilter: ['data-gradient-start', 'data-gradient-middle', 'data-gradient-end', 'data-gradient-angle'] });
    return () => observer?.disconnect();
  },
);

const EMPTY_SLIDE: PresentationSequence = {
  id: '',
  title: '',
  message: '',
  notes: '',
  durationMinutes: 0,
  transition: 'Fondu',
  code: '',
  codeLanguage: 'typescript',
  imageUrl: '',
  imageAlt: '',
};

const EMPTY_PROCESS_STATUS: PresentationDemoWorkspaceProcessStatus = {
  id: 'none',
  state: 'stopped',
  terminalState: 'idle',
  url: '',
  command: '',
  terminalCommand: '',
  runtime: '',
  logs: [],
};

type PresentationImageViewer = {
  url: string;
  alt: string;
};

type ActiveCodeWorkspace = {
  readonly id: PresentationDemoWorkspaceId;
};

type PresentationAnnotationTool = 'pointer' | 'pen' | 'highlighter' | 'arrow' | 'rectangle' | 'eraser';
type PresentationAnnotationCommand = PresentationAnnotationTool | 'undo' | 'clear';
type PresentationAnnotationPoint = { x: number; y: number };
type PresentationAnnotationStroke = {
  tool: Exclude<PresentationAnnotationTool, 'pointer'>;
  points: readonly PresentationAnnotationPoint[];
};

const presentationAnnotationShortcuts: Record<PresentationAnnotationCommand, string> = {
  pointer: 'V',
  pen: 'P',
  highlighter: 'H',
  arrow: 'A',
  rectangle: 'R',
  eraser: 'E',
  undo: 'Ctrl/Cmd+Z',
  clear: 'Shift+Delete',
};

function annotationActionTitle(label: string, command: PresentationAnnotationCommand): string {
  return `${label} · ${presentationAnnotationShortcuts[command]}`;
}

const focusCodeWorkspaceInput = craftNodeDirective(
  'focusCodeWorkspaceInput',
  [],
  ({ element }) => {
    queueMicrotask(() => {
      if (element instanceof HTMLInputElement) {
        element.focus();
        element.select();
      }
    });
  },
);

const pollDemoWorkspaceProcess = craftNodeDirective(
  'pollDemoWorkspaceProcess',
  [],
  (context) => {
    const temporalRuntime = context.injector.get(CRAFT_TEMPORAL_RUNTIME);
    const destroyRef = context.injector.get(DestroyRef);
    let task: TemporalTaskHandle | undefined;
    let disposed = false;
    const schedule = () => {
      if (disposed) return;
      task = temporalRuntime.schedule(() => {
        if (disposed) return;
        context.element.dispatchEvent(new Event('demoWorkspaceProcessRefresh'));
        schedule();
      }, 1_200, { kind: 'demo-process-poll', owner: 'presentation-demo-terminal', destroyRef });
    };
    schedule();
    return () => {
      disposed = true;
      task?.cancel();
    };
  },
);

function annotationStrokeStyle(context: CanvasRenderingContext2D, tool: PresentationAnnotationStroke['tool']): void {
  context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
  context.globalAlpha = tool === 'highlighter' ? 0.38 : 0.95;
  context.strokeStyle = tool === 'highlighter' ? '#ffe45c' : '#ff3d81';
  context.lineWidth = tool === 'highlighter' ? 22 : tool === 'eraser' ? 30 : 4;
  context.lineCap = 'round';
  context.lineJoin = 'round';
}

function drawAnnotationStroke(context: CanvasRenderingContext2D, stroke: PresentationAnnotationStroke): void {
  const [firstPoint, ...remainingPoints] = stroke.points;
  if (!firstPoint) return;
  const lastPoint = stroke.points[stroke.points.length - 1] ?? firstPoint;
  context.save();
  annotationStrokeStyle(context, stroke.tool);

  if (stroke.tool === 'rectangle') {
    context.strokeRect(
      Math.min(firstPoint.x, lastPoint.x),
      Math.min(firstPoint.y, lastPoint.y),
      Math.abs(lastPoint.x - firstPoint.x),
      Math.abs(lastPoint.y - firstPoint.y),
    );
    context.restore();
    return;
  }

  if (stroke.tool === 'arrow') {
    const angle = Math.atan2(lastPoint.y - firstPoint.y, lastPoint.x - firstPoint.x);
    const headLength = 14;
    context.beginPath();
    context.moveTo(firstPoint.x, firstPoint.y);
    context.lineTo(lastPoint.x, lastPoint.y);
    context.stroke();
    context.beginPath();
    context.moveTo(lastPoint.x - headLength * Math.cos(angle - Math.PI / 6), lastPoint.y - headLength * Math.sin(angle - Math.PI / 6));
    context.lineTo(lastPoint.x, lastPoint.y);
    context.lineTo(lastPoint.x - headLength * Math.cos(angle + Math.PI / 6), lastPoint.y - headLength * Math.sin(angle + Math.PI / 6));
    context.stroke();
    context.restore();
    return;
  }

  context.beginPath();
  context.moveTo(firstPoint.x, firstPoint.y);
  if (remainingPoints.length === 0) {
    context.arc(firstPoint.x, firstPoint.y, Math.max(1, context.lineWidth / 2), 0, Math.PI * 2);
  } else if (remainingPoints.length === 1) {
    context.lineTo(remainingPoints[0].x, remainingPoints[0].y);
  } else {
    for (let index = 0; index < remainingPoints.length - 1; index += 1) {
      const point = remainingPoints[index];
      const nextPoint = remainingPoints[index + 1];
      context.quadraticCurveTo(point.x, point.y, (point.x + nextPoint.x) / 2, (point.y + nextPoint.y) / 2);
    }
    const penultimatePoint = remainingPoints[remainingPoints.length - 1];
    context.quadraticCurveTo(penultimatePoint.x, penultimatePoint.y, lastPoint.x, lastPoint.y);
  }
  context.stroke();
  context.restore();
}

const presentationAnnotationCanvas = craftNodeDirective(
  'presentationAnnotationCanvas',
  [],
  ({ element }) => {
    const canvas = element as HTMLCanvasElement;
    const slide = canvas.closest<HTMLElement>('.presentation-stage__slide');
    const stage = canvas.closest<HTMLElement>('.presentation-stage');
    const context = canvas.getContext('2d');
    if (!slide || !stage || !context) return;
    const shell = stage.closest<HTMLElement>('.presentation-shell');

    let strokes: PresentationAnnotationStroke[] = [];
    let currentStroke: PresentationAnnotationStroke | undefined;
    let disposed = false;

    const syncToolbar = () => {
      const tool = (canvas.dataset.annotationTool ?? 'pointer') as PresentationAnnotationTool;
      canvas.dataset.annotationActive = String(tool !== 'pointer');
      shell?.querySelectorAll<HTMLElement>('.presentation-annotation-toolbar [data-annotation-tool]').forEach((control) => {
        const active = control.dataset.annotationTool === tool;
        control.dataset.active = String(active);
        control.setAttribute('aria-pressed', String(active));
      });
      shell?.querySelectorAll<HTMLButtonElement>('.presentation-annotation-toolbar [data-annotation-action="undo"], .presentation-annotation-toolbar [data-annotation-action="clear"]').forEach((control) => {
        control.disabled = strokes.length === 0;
      });
    };
    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const pixelRatio = canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1;
      canvas.width = Math.max(1, Math.round(bounds.width * pixelRatio));
      canvas.height = Math.max(1, Math.round(bounds.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      for (const stroke of strokes) drawAnnotationStroke(context, stroke);
    };
    const pointFromEvent = (event: PointerEvent): PresentationAnnotationPoint => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const redraw = () => {
      const bounds = canvas.getBoundingClientRect();
      context.clearRect(0, 0, bounds.width, bounds.height);
      for (const stroke of strokes) drawAnnotationStroke(context, stroke);
      syncToolbar();
    };
    const command = (value: PresentationAnnotationCommand) => {
      if (value === 'pointer' || value === 'pen' || value === 'highlighter' || value === 'arrow' || value === 'rectangle' || value === 'eraser') {
        canvas.dataset.annotationTool = value;
      } else if (value === 'undo') {
        strokes = strokes.slice(0, -1);
        redraw();
      } else if (value === 'clear') {
        strokes = [];
        redraw();
      }
      syncToolbar();
    };
    const onCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const value = event.detail;
      if (value === 'pointer' || value === 'pen' || value === 'highlighter' || value === 'arrow' || value === 'rectangle' || value === 'eraser' || value === 'undo' || value === 'clear') {
        command(value);
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || canvas.dataset.annotationTool === 'pointer') return;
      const tool = canvas.dataset.annotationTool as PresentationAnnotationStroke['tool'];
      if (tool !== 'pen' && tool !== 'highlighter' && tool !== 'arrow' && tool !== 'rectangle' && tool !== 'eraser') return;
      currentStroke = { tool, points: [pointFromEvent(event)] };
      strokes = [...strokes, currentStroke];
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!currentStroke) return;
      currentStroke = { ...currentStroke, points: [...currentStroke.points, pointFromEvent(event)] };
      strokes = [...strokes.slice(0, -1), currentStroke];
      redraw();
      event.preventDefault();
    };
    const stopDrawing = (event: PointerEvent) => {
      if (!currentStroke) return;
      currentStroke = undefined;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      syncToolbar();
    };
    const onKeydown = (event: KeyboardEvent) => {
      const isShortcut = event.ctrlKey || event.metaKey;
      if (event.key === 'Escape' && canvas.dataset.annotationTool !== 'pointer') {
        event.preventDefault();
        command('pointer');
        return;
      }
      if (isShortcut && event.key.toLowerCase() === 'z' && strokes.length > 0) {
        event.preventDefault();
        command('undo');
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (!isShortcut && !event.altKey) {
        const tool = ({ v: 'pointer', p: 'pen', h: 'highlighter', a: 'arrow', r: 'rectangle', e: 'eraser' } as const)[event.key.toLowerCase()];
        if (tool) {
          event.preventDefault();
          command(tool);
        } else if (event.shiftKey && event.key === 'Delete') {
          event.preventDefault();
          command('clear');
        }
      }
    };

    canvas.addEventListener('presentation-annotation-command', onCommand);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    shell?.addEventListener('keydown', onKeydown);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    queueMicrotask(() => {
      if (!disposed) {
        resize();
        syncToolbar();
      }
    });

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      canvas.removeEventListener('presentation-annotation-command', onCommand);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', stopDrawing);
      canvas.removeEventListener('pointercancel', stopDrawing);
      shell?.removeEventListener('keydown', onKeydown);
    };
  },
);

const presentationAnnotationToolbar = craftNodeDirective(
  'presentationAnnotationToolbar',
  [],
  ({ element }) => {
    const toolbar = element as HTMLElement;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      const shell = toolbar.closest<HTMLElement>('.presentation-shell');
      const onClick = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const control = target.closest<HTMLElement>('[data-annotation-tool], [data-annotation-action]');
        if (!control || !toolbar.contains(control)) return;
        const command = control.dataset.annotationTool ?? control.dataset.annotationAction;
        if (!command) return;
        const canvas = shell?.querySelector<HTMLCanvasElement>('.presentation-stage .presentation-annotation-canvas');
        if (!canvas) return;
        canvas.dispatchEvent(new CustomEvent('presentation-annotation-command', { detail: command }));
        event.preventDefault();
      };
      toolbar.addEventListener('click', onClick);
      cleanup = () => toolbar.removeEventListener('click', onClick);
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  },
);

function clampImageViewerZoom(value: number): number {
  return Math.min(Math.max(value, 1), 4);
}

const focusPresentationStage = craftNodeDirective(
  'focusPresentationStage',
  [],
  ({ element }) => {
    if ('focus' in element && typeof element.focus === 'function') {
      element.focus();
    }
  },
);

const dragPresentationSurface = craftNodeDirective(
  'dragPresentationSurface',
  [],
  ({ element }) => {
    const handle = element as HTMLElement;
    const surface = handle.dataset.dragSurface === 'notes'
      ? handle.closest<HTMLElement>('.presentation-notes')
      : handle.dataset.dragSurface === 'annotations'
        ? handle.closest<HTMLElement>('.presentation-annotation-toolbar')
        : handle.dataset.dragSurface === 'shortcuts'
          ? handle.closest<HTMLElement>('.presentation-code-workspace__shortcuts')
        : handle;
    if (!surface) return;

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;
    const clamp = (value: number, minimum: number, maximum: number) => Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      const bounds = surface.getBoundingClientRect();
      const view = surface.ownerDocument.defaultView;
      const maxX = (view?.innerWidth ?? bounds.width) - bounds.width - 12;
      const maxY = (view?.innerHeight ?? bounds.height) - bounds.height - 12;
      surface.style.left = `${clamp(event.clientX - offsetX, 12, maxX)}px`;
      surface.style.top = `${clamp(event.clientY - offsetY, 12, maxY)}px`;
      surface.style.right = 'auto';
      surface.style.bottom = 'auto';
    };
    const stop = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      surface.dataset.dragging = 'false';
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    };
    const start = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (surface === handle && event.target instanceof Element && event.target.closest('a,button,input,select,textarea')) return;
      const bounds = surface.getBoundingClientRect();
      dragging = true;
      offsetX = event.clientX - bounds.left;
      offsetY = event.clientY - bounds.top;
      surface.dataset.dragging = 'true';
      surface.style.position = 'fixed';
      surface.style.zIndex = handle.dataset.dragSurface === 'topbar' ? '20' : '12';
      surface.style.width = `${bounds.width}px`;
      surface.style.height = `${bounds.height}px`;
      surface.style.margin = '0';
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    };

    handle.addEventListener('pointerdown', start);
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
    return () => {
      handle.removeEventListener('pointerdown', start);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
  },
);

const imageViewerInteraction = craftNodeDirective(
  'imageViewerInteraction',
  [],
  ({ element }) => {
    const viewer = element as HTMLElement;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    queueMicrotask(() => {
      if (disposed) return;
      const viewport = viewer.querySelector<HTMLElement>('.presentation-image-viewer__viewport');
      const image = viewer.querySelector<HTMLImageElement>('.presentation-image-viewer__image');
      if (!viewport || !image) return;

      let zoom = 1;
      let offsetX = 0;
      let offsetY = 0;
      let dragging = false;
      let lastX = 0;
      let lastY = 0;

      const clampOffset = () => {
      const bounds = viewport.getBoundingClientRect();
      const maxX = Math.max(0, (image.offsetWidth * zoom - bounds.width) / 2);
      const maxY = Math.max(0, (image.offsetHeight * zoom - bounds.height) / 2);
      offsetX = Math.min(Math.max(offsetX, -maxX), maxX);
      offsetY = Math.min(Math.max(offsetY, -maxY), maxY);
      };
      const update = () => {
      clampOffset();
      image.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${zoom})`;
      viewer.dataset.zoomed = String(zoom > 1);
      const zoomLabel = viewer.querySelector<HTMLElement>('.presentation-image-viewer__zoom-value');
      if (zoomLabel) zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      };
      const setZoom = (value: number) => {
      zoom = clampImageViewerZoom(value);
      if (zoom === 1) {
        offsetX = 0;
        offsetY = 0;
      }
      update();
      };
      const onImageLoad = () => update();
      const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25));
      };
      const onPointerDown = (event: PointerEvent) => {
      if (zoom === 1 || event.button !== 0) return;
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      viewer.dataset.dragging = 'true';
      image.setPointerCapture(event.pointerId);
      event.preventDefault();
      };
      const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      offsetX += event.clientX - lastX;
      offsetY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      update();
      };
      const stopDragging = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      viewer.dataset.dragging = 'false';
      if (image.hasPointerCapture(event.pointerId)) image.releasePointerCapture(event.pointerId);
      };
      const onDoubleClick = () => setZoom(zoom === 1 ? 2 : 1);
      const onControlClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>('[data-image-viewer-action]');
      if (!control || !viewer.contains(control)) return;
      const action = control.dataset.imageViewerAction;
      if (action === 'zoom-in') setZoom(zoom + 0.25);
      else if (action === 'zoom-out') setZoom(zoom - 0.25);
      else if (action === 'reset') setZoom(1);
      };

      image.addEventListener('load', onImageLoad);
      viewport.addEventListener('wheel', onWheel, { passive: false });
      image.addEventListener('pointerdown', onPointerDown);
      image.addEventListener('pointermove', onPointerMove);
      image.addEventListener('pointerup', stopDragging);
      image.addEventListener('pointercancel', stopDragging);
      image.addEventListener('dblclick', onDoubleClick);
      viewer.addEventListener('click', onControlClick);
      update();

      cleanup = () => {
        image.removeEventListener('load', onImageLoad);
        viewport.removeEventListener('wheel', onWheel);
        image.removeEventListener('pointerdown', onPointerDown);
        image.removeEventListener('pointermove', onPointerMove);
        image.removeEventListener('pointerup', stopDragging);
        image.removeEventListener('pointercancel', stopDragging);
        image.removeEventListener('dblclick', onDoubleClick);
        viewer.removeEventListener('click', onControlClick);
      };
    });
    return () => {
      disposed = true;
      cleanup?.();
    };
  },
);

const embedPresentationLink = craftNodeDirective(
  'embedPresentationLink',
  [],
  ({ element }) => {
    const frame = element as HTMLIFrameElement;
    const safeUrlValue = safePresentationEmbeddedUrl(frame.dataset.source ?? '');
    if (safeUrlValue) frame.src = safeUrlValue;
  },
);

function createPresentationPage(name: string, presenterMode: boolean) {
  return craftComponent(
    name,
    {},
    function* (presentationId: Input<string>) {
      const presentation = yield* query('presentationStage', {
        params: presentationId,
        loader: function* ({ params }) {
          return yield* loadPresentation(params);
        },
      });
      const slideIndex = yield* state('slideIndex', 0, ({ set }) => ({
        setIndex: (value: number) => set(value),
      }));
      const notesVisible = yield* state('notesVisible', false, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const activeLink = yield* state('activeLink', null as string | null, ({ set }) => ({
        open: (url: string) => set(url),
        close: () => set(null),
      }));
      const activeCodeWorkspace = yield* state('activeCodeWorkspace', null as ActiveCodeWorkspace | null, ({ set }) => ({
        open: (value: ActiveCodeWorkspace) => set(value),
        close: () => set(null),
      }));
      const terminalVisible = yield* state('terminalVisible', false, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const terminalCommand = yield* state('terminalCommand', '', ({ set }) => ({
        setCommand: (value: string) => set(value),
      }));
      const codeFilesVisible = yield* state('codeFilesVisible', true, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const codeQuickOpenVisible = yield* state('codeQuickOpenVisible', false, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const codeFileQuery = yield* state('codeFileQuery', '', ({ set }) => ({
        setQuery: (value: string) => set(value),
      }));
      const codeSearchVisible = yield* state('codeSearchVisible', false, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const codeSearchQuery = yield* state('codeSearchQuery', '', ({ set }) => ({
        setQuery: (value: string) => set(value),
      }));
      const selectedCodePath = yield* state('selectedCodePath', '', ({ set }) => ({
        select: (value: string) => set(value),
      }));
      const imageViewer = yield* state('imageViewer', null as PresentationImageViewer | null, ({ set }) => ({
        open: (value: PresentationImageViewer) => set(value),
        close: () => set(null),
      }));
      const overview = yield* state('overview', true, ({ set }) => ({
        show: () => set(true),
        hide: () => set(false),
      }));
      const linkReturnState = yield* state('linkReturnState', false, ({ set }) => ({
        remember: (wasOverviewVisible: boolean) => set(wasOverviewVisible),
        clear: () => set(false),
      }));
      const publicNotesHidden = craftComputed('publicNotesHidden', () => false);
      const showNotes = presenterMode ? notesVisible : publicNotesHidden;
      const hasCoverImage = craftComputed('hasCoverImage', function* () {
        return Boolean((yield* presentation.value())?.coverImageUrl);
      });
      const hasBackgroundImage = craftComputed('hasBackgroundImage', function* () {
        const document = yield* presentation.value();
        return document?.backgroundType === 'image' && Boolean(document.backgroundUrl);
      });
      const hasBackgroundVideo = craftComputed('hasBackgroundVideo', function* () {
        const document = yield* presentation.value();
        return document?.backgroundType === 'video' && Boolean(document.backgroundUrl);
      });
      const showStage = craftComputed('showStage', function* () {
        return !(yield* overview());
      });
      const activeDemoWorkspaceId = craftComputed('activeDemoWorkspaceId', function* () {
        const document = yield* presentation.value();
        if (!document) return 'none';
        const slides = document.sections.flatMap((section) => section.sequences.map((sequence) => ({ section, sequence })));
        const active = slides[yield* slideIndex()];
        return active?.sequence.demoWorkspaceId && active.sequence.demoWorkspaceId !== 'none'
          ? active.sequence.demoWorkspaceId
          : active?.section.demoWorkspaceId && active.section.demoWorkspaceId !== 'none'
            ? active.section.demoWorkspaceId
            : document.demoWorkspaceId;
      });
      const demoWorkspace = yield* query('presentationDemoWorkspace', {
        params: function* () {
          return yield* activeDemoWorkspaceId();
        },
        loader: function* ({ params }) {
          return yield* loadDemoWorkspace(params);
        },
      });
      const startDemoWorkspace = yield* mutation('startDemoWorkspaceProcess', {
        method: (id: PresentationDemoWorkspaceId) => id,
        loader: function* ({ params }) {
          return yield* startDemoWorkspaceProcessRequest(params);
        },
      });
      const stopDemoWorkspace = yield* mutation('stopDemoWorkspaceProcess', {
        method: (id: PresentationDemoWorkspaceId) => id,
        loader: function* ({ params }) {
          return yield* stopDemoWorkspaceProcessRequest(params);
        },
      });
      const runDemoWorkspaceCommand = yield* mutation('runDemoWorkspaceCommand', {
        method: (input: { readonly id: PresentationDemoWorkspaceId; readonly command: string }) => input,
        loader: function* ({ params }) {
          return yield* executeDemoWorkspaceCommand(params.id, params.command);
        },
      });
      const demoWorkspaceProcessStatus = yield* query(
        'demoWorkspaceProcessStatus',
        {
          params: function* () {
            return yield* activeDemoWorkspaceId();
          },
          loader: function* ({ params }) {
            return yield* loadDemoWorkspaceProcessStatus(params);
          },
        },
        insertQueryPipe(
          insertReactOnMutation(startDemoWorkspace, { reload: { onMutationResolved: true } }),
          insertReactOnMutation(stopDemoWorkspace, { reload: { onMutationResolved: true } }),
          insertReactOnMutation(runDemoWorkspaceCommand, { reload: { onMutationResolved: true } }),
        ),
      );
      const hasImageViewer = craftComputed('hasImageViewer', function* () {
        return Boolean(yield* imageViewer());
      });
      const slides = craftComputed('slides', function* () {
        const document = yield* presentation.value();
        return document?.sections.flatMap((part) => part.sequences) ?? [];
      });
      const sectionNavigation = craftComputed('sectionNavigation', function* () {
        const document = yield* presentation.value();
        let slideOffset = 0;
        return document?.sections.map((part) => {
          const sequences = part.sequences.map((sequence) => {
            const navigationSequence = { ...sequence, slideIndex: slideOffset };
            slideOffset += 1;
            return navigationSequence;
          });
          return {
            ...part,
            firstSlideIndex: sequences[0]?.slideIndex ?? 0,
            sequences,
          };
        }) ?? [];
      });
      const currentSlide = craftComputed('currentSlide', function* () {
        return (yield* slides())[yield* slideIndex()] ?? EMPTY_SLIDE;
      });
      const currentSectionTitle = craftComputed('currentSectionTitle', function* () {
        const document = yield* presentation.value();
        const slide = yield* currentSlide();
        return document?.sections.find((part) => part.sequences.some((sequence) => sequence.id === slide.id))?.title ?? '';
      });
      const currentSectionIntention = craftComputed('currentSectionIntention', function* () {
        const document = yield* presentation.value();
        const slide = yield* currentSlide();
        return document?.sections.find((part) => part.sequences.some((sequence) => sequence.id === slide.id))?.intention ?? '';
      });
      const hasImage = craftComputed('hasImage', function* () {
        return Boolean((yield* currentSlide()).imageUrl);
      });
      const hasCode = craftComputed('hasCode', function* () {
        return Boolean((yield* currentSlide()).code);
      });
      const highlightedCode = craftComputed('highlightedCode', function* () {
        const slide = yield* currentSlide();
        return highlightCodeTokens(slide.code, slide.codeLanguage);
      });
      const noteParts = craftComputed('noteParts', function* () {
        return extractPresentationNoteParts((yield* currentSlide()).notes);
      });
      const hasActiveLink = craftComputed('hasActiveLink', function* () {
        return Boolean(yield* activeLink());
      });
      const hasActiveCodeWorkspace = craftComputed('hasActiveCodeWorkspace', function* () {
        return Boolean(yield* activeCodeWorkspace());
      });
      const hasDemoWorkspace = craftComputed('hasDemoWorkspace', function* () {
        return (yield* demoWorkspace.value())?.id !== 'none';
      });
      const processStatus = craftComputed('processStatus', function* () {
        return (yield* demoWorkspaceProcessStatus.value()) ?? EMPTY_PROCESS_STATUS;
      });
      const processStatusLabel = craftComputed('processStatusLabel', function* () {
        const status = yield* processStatus();
        if (status.state === 'starting') return i18n.t('ui.presentation.demoStarting');
        if (status.state === 'running') return i18n.t('ui.presentation.demoRunning');
        if (status.state === 'stopping') return i18n.t('ui.presentation.demoStopping');
        if (status.state === 'error') return i18n.t('ui.presentation.demoError');
        return i18n.t('ui.presentation.demoStopped');
      });
      const processIsRunning = craftComputed('processIsRunning', function* () {
        return (yield* processStatus()).state === 'running';
      });
      const processIsBusy = craftComputed('processIsBusy', function* () {
        const status = (yield* processStatus()).state;
        return status === 'starting' || status === 'stopping';
      });
      const terminalIsBusy = craftComputed('terminalIsBusy', function* () {
        return (yield* processStatus()).terminalState === 'running';
      });
      const processUrl = craftComputed('processUrl', function* () {
        const status = yield* processStatus();
        return safePresentationLinkUrl(status.url);
      });
      const showOverviewContent = craftComputed('showOverviewContent', function* () {
        return !(yield* hasActiveLink()) && !(yield* hasActiveCodeWorkspace());
      });
      const workspaceFiles = craftComputed('workspaceFiles', function* () {
        return (yield* demoWorkspace.value())?.files ?? [];
      });
      const visibleWorkspaceFiles = craftComputed('visibleWorkspaceFiles', function* () {
        const queryValue = (yield* codeFileQuery()).trim().toLowerCase();
        return (yield* workspaceFiles()).filter((file) => !queryValue || file.path.toLowerCase().includes(queryValue));
      });
      const selectedWorkspaceFile = craftComputed('selectedWorkspaceFile', function* () {
        const files = yield* workspaceFiles();
        const selectedPath = yield* selectedCodePath();
        const selected = files.find((file) => file.path === selectedPath);
        return selected ?? files[0] ?? null;
      });
      const highlightedWorkspaceCode = craftComputed('highlightedWorkspaceCode', function* () {
        const file = yield* selectedWorkspaceFile();
        return file ? highlightCodeTokens(file.content, file.language) : [];
      });
      const workspaceSearchMatches = craftComputed('workspaceSearchMatches', function* () {
        const queryValue = (yield* codeSearchQuery()).trim().toLowerCase();
        if (!queryValue) return [] as readonly PresentationDemoWorkspaceFile[];
        return (yield* workspaceFiles()).filter((file) => file.content.toLowerCase().includes(queryValue));
      });
      const codeFileListVisible = craftComputed('codeFileListVisible', function* () {
        return !(yield* codeSearchVisible());
      });
      const noWorkspaceFiles = craftComputed('noWorkspaceFiles', function* () {
        return (yield* workspaceFiles()).length === 0;
      });
      const slideItems = craftComputed('slideItems', function* () {
        const slide = yield* currentSlide();
        return slide.id ? [slide] : [];
      });
      const progressPercent = craftComputed('progressPercent', function* () {
        const count = (yield* slides()).length;
        return count === 0 ? 0 : ((yield* slideIndex()) + 1) / count * 100;
      });
      const next = craftMethod('next', function* () {
        const count = (yield* slides()).length;
        const current = yield* slideIndex();
        if (yield* overview()) {
          if (count > 0) {
            yield* overview.hide();
            yield* slideIndex.setIndex(0);
          }
          return;
        }
        if (current < count - 1) yield* slideIndex.setIndex(current + 1);
      });
      const previous = craftMethod('previous', function* () {
        const current = yield* slideIndex();
        if (current > 0) yield* slideIndex.setIndex(current - 1);
      });
      const openImageViewer = craftMethod('openImageViewer', function* () {
        const slide = yield* currentSlide();
        const url = safePresentationImageUrl(slide.imageUrl);
        if (url) yield* imageViewer.open({ url, alt: slide.imageAlt || i18n.t('ui.editor.imageAltFallback') });
      });
      const closeImageViewer = craftMethod('closeImageViewer', function* () {
        yield* imageViewer.close();
      });
      const handleKeydown = craftMethod('handleKeydown', function* (event: KeyboardEvent) {
        if (yield* imageViewer()) {
          if (event.key === 'Escape') {
            event.preventDefault();
            yield* imageViewer.close();
          }
          return;
        }
        if (yield* activeLink()) {
          if (event.key === 'Escape') {
            event.preventDefault();
            yield* activeLink.close();
          }
          return;
        }
        if (yield* activeCodeWorkspace()) {
          const isShortcut = event.ctrlKey || event.metaKey;
          if (event.key === 'Escape') {
            event.preventDefault();
            if (yield* codeQuickOpenVisible()) yield* codeQuickOpenVisible.hide();
            else {
              yield* activeCodeWorkspace.close();
              yield* codeSearchVisible.hide();
              yield* codeFileQuery.setQuery('');
              yield* codeSearchQuery.setQuery('');
              if (!(yield* linkReturnState())) yield* overview.hide();
              yield* linkReturnState.clear();
            }
            return;
          }
          if (isShortcut && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            yield* codeQuickOpenVisible.show();
            yield* codeSearchVisible.hide();
            return;
          }
          if (isShortcut && event.key.toLowerCase() === 'b') {
            event.preventDefault();
            if (yield* codeFilesVisible()) yield* codeFilesVisible.hide(); else yield* codeFilesVisible.show();
            return;
          }
          if (isShortcut && event.shiftKey && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            if (!(yield* codeFilesVisible())) yield* codeFilesVisible.show();
            yield* codeSearchVisible.show();
            yield* codeQuickOpenVisible.hide();
            return;
          }
          return;
        }
        const count = (yield* slides()).length;
        const current = yield* slideIndex();
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown') {
          event.preventDefault();
          if (current < count - 1) yield* slideIndex.setIndex(current + 1);
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
          event.preventDefault();
          if (current > 0) yield* slideIndex.setIndex(current - 1);
        } else if (event.key === 'Home') {
          event.preventDefault();
          yield* overview.show();
          yield* slideIndex.setIndex(0);
        } else if (event.key === 'End') {
          event.preventDefault();
          if (count > 0) yield* slideIndex.setIndex(count - 1);
          yield* overview.hide();
        }
      });
      const selectSlide = craftMethod('selectSlide', function* (index: number) {
        const count = (yield* slides()).length;
        if (index >= 0 && index < count) {
          yield* slideIndex.setIndex(index);
          yield* overview.hide();
        }
      });
      const toggleNotes = craftMethod('toggleNotes', function* () {
        if (yield* notesVisible()) yield* notesVisible.hide(); else yield* notesVisible.show();
      });
      const toggleCodeFiles = craftMethod('toggleCodeFiles', function* () {
        if (yield* codeFilesVisible()) yield* codeFilesVisible.hide(); else yield* codeFilesVisible.show();
      });
      const openPresentationLink = craftMethod('openPresentationLink', function* (url: string) {
        const safeUrlValue = safePresentationLinkUrl(url);
        if (safeUrlValue) {
          yield* linkReturnState.remember(yield* overview());
          yield* overview.show();
          yield* activeLink.open(safeUrlValue);
        }
      });
      const openCodeWorkspace = craftMethod('openCodeWorkspace', function* () {
        const workspaceId = yield* activeDemoWorkspaceId();
        if (workspaceId === 'none') return;
        yield* linkReturnState.remember(yield* overview());
        yield* overview.show();
        yield* activeLink.close();
        yield* activeCodeWorkspace.open({ id: workspaceId });
        yield* terminalVisible.hide();
      });
      const openDemoTerminal = craftMethod('openDemoTerminal', function* () {
        const workspaceId = yield* activeDemoWorkspaceId();
        if (workspaceId === 'none') return;
        yield* linkReturnState.remember(yield* overview());
        yield* overview.show();
        yield* activeLink.close();
        yield* activeCodeWorkspace.open({ id: workspaceId });
        yield* terminalVisible.show();
        yield* codeFilesVisible.hide();
        yield* demoWorkspaceProcessStatus.resource.reload();
      });
      const toggleDemoTerminal = craftMethod('toggleDemoTerminal', function* () {
        if (yield* terminalVisible()) yield* terminalVisible.hide();
        else {
          yield* terminalVisible.show();
          yield* codeFilesVisible.hide();
          yield* demoWorkspaceProcessStatus.resource.reload();
        }
      });
      const refreshDemoWorkspaceProcess = craftMethod('refreshDemoWorkspaceProcess', function* () {
        yield* demoWorkspaceProcessStatus.resource.reload();
      });
      const startDemoWorkspaceProcess = craftMethod('startDemoWorkspaceProcess', function* () {
        const workspaceId = yield* activeDemoWorkspaceId();
        if (workspaceId === 'none') return;
        yield* startDemoWorkspace.mutate(workspaceId);
      });
      const stopDemoWorkspaceProcess = craftMethod('stopDemoWorkspaceProcess', function* () {
        const workspaceId = yield* activeDemoWorkspaceId();
        if (workspaceId === 'none') return;
        yield* stopDemoWorkspace.mutate(workspaceId);
      });
      const runDemoCommand = craftMethod('runDemoCommand', function* () {
        const workspaceId = yield* activeDemoWorkspaceId();
        const command = (yield* terminalCommand()).trim();
        if (workspaceId === 'none' || !command || (yield* terminalIsBusy())) return;
        yield* runDemoWorkspaceCommand.mutate({ id: workspaceId, command });
      });
      const closeCodeWorkspace = craftMethod('closeCodeWorkspace', function* () {
        yield* activeCodeWorkspace.close();
        yield* terminalVisible.hide();
        yield* codeQuickOpenVisible.hide();
        yield* codeSearchVisible.hide();
        yield* codeFileQuery.setQuery('');
        yield* codeSearchQuery.setQuery('');
        if (!(yield* linkReturnState())) yield* overview.hide();
        yield* linkReturnState.clear();
      });
      const selectCodeFile = craftMethod('selectCodeFile', function* (path: string) {
        yield* selectedCodePath.select(path);
        yield* codeQuickOpenVisible.hide();
      });
      const closePresentationLink = craftMethod('closePresentationLink', function* () {
        yield* activeLink.close();
        if (!(yield* linkReturnState())) yield* overview.hide();
        yield* linkReturnState.clear();
      });
      return { presentation, demoWorkspace, demoWorkspaceProcessStatus, overview, hasCoverImage, hasBackgroundImage, hasBackgroundVideo, showStage, hasImageViewer, slideIndex, slides, sectionNavigation, currentSlide, currentSectionTitle, currentSectionIntention, progressPercent, showNotes, hasImage, hasCode, highlightedCode, noteParts, hasActiveLink, hasActiveCodeWorkspace, hasDemoWorkspace, activeDemoWorkspaceId, processStatus, processStatusLabel, processIsRunning, processIsBusy, terminalIsBusy, processUrl, terminalVisible, terminalCommand, showOverviewContent, activeLink, activeCodeWorkspace, codeFilesVisible, codeQuickOpenVisible, codeFileQuery, codeSearchVisible, codeSearchQuery, selectedCodePath, visibleWorkspaceFiles, selectedWorkspaceFile, highlightedWorkspaceCode, workspaceSearchMatches, codeFileListVisible, noWorkspaceFiles, imageViewer, slideItems, next, previous, handleKeydown, selectSlide, toggleNotes, toggleCodeFiles, openPresentationLink, closePresentationLink, openCodeWorkspace, openDemoTerminal, toggleDemoTerminal, refreshDemoWorkspaceProcess, startDemoWorkspaceProcess, stopDemoWorkspaceProcess, runDemoCommand, closeCodeWorkspace, selectCodeFile, openImageViewer, closeImageViewer, presentationId };
    },
    ({ presentation, demoWorkspace, demoWorkspaceProcessStatus, overview, hasCoverImage, hasBackgroundImage, hasBackgroundVideo, showStage, hasImageViewer, slideIndex, slides, sectionNavigation, currentSlide, currentSectionTitle, currentSectionIntention, progressPercent, showNotes, hasImage, hasCode, highlightedCode, noteParts, hasActiveLink, hasActiveCodeWorkspace, hasDemoWorkspace, processStatus, processStatusLabel, processIsRunning, processIsBusy, terminalIsBusy, processUrl, terminalVisible, terminalCommand, showOverviewContent, activeLink, codeFilesVisible, codeQuickOpenVisible, codeFileQuery, codeSearchVisible, codeSearchQuery, visibleWorkspaceFiles, selectedWorkspaceFile, highlightedWorkspaceCode, workspaceSearchMatches, codeFileListVisible, noWorkspaceFiles, imageViewer, slideItems, next, previous, selectSlide, toggleNotes, toggleCodeFiles, openPresentationLink, closePresentationLink, openCodeWorkspace, openDemoTerminal, toggleDemoTerminal, refreshDemoWorkspaceProcess, startDemoWorkspaceProcess, stopDemoWorkspaceProcess, runDemoCommand, closeCodeWorkspace, selectCodeFile, openImageViewer, closeImageViewer, handleKeydown, presentationId }) =>
      div({ class: 'presentation-shell', 'data-layout': function* () { return (yield* presentation.value())?.layout ?? 'desktop'; }, 'data-theme': function* () { return (yield* presentation.value())?.backgroundTheme ?? 'aurora'; }, 'data-background-type': function* () { return (yield* presentation.value())?.backgroundType ?? 'theme'; }, 'data-gradient-start': function* () { return (yield* presentation.value())?.backgroundGradientStart ?? PRESENTATION_THEME_GRADIENTS.aurora.start; }, 'data-gradient-middle': function* () { return (yield* presentation.value())?.backgroundGradientMiddle ?? PRESENTATION_THEME_GRADIENTS.aurora.middle; }, 'data-gradient-end': function* () { return (yield* presentation.value())?.backgroundGradientEnd ?? PRESENTATION_THEME_GRADIENTS.aurora.end; }, 'data-gradient-angle': function* () { return String((yield* presentation.value())?.backgroundGradientAngle ?? PRESENTATION_THEME_GRADIENTS.aurora.angle); }, 'data-decoration': function* () { return (yield* presentation.value())?.backgroundDecoration ?? 'orb'; }, 'data-decoration-color': function* () { return (yield* presentation.value())?.backgroundDecorationColor ?? '#f736e3'; }, 'data-presenter': presenterMode ? 'true' : 'false', role: 'application', 'aria-label': i18n.t('ui.presentation.stage'), tabIndex: 0, *keydown(event) { yield* handleKeydown(event); } }, [
        // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationMediaUrl validates the protocol and origin.
        ifNode(hasBackgroundImage, () => img({ class: 'presentation-background-media', src: function* () { return safePresentationMediaUrl((yield* presentation.value())?.backgroundUrl ?? ''); }, alt: '' })),
        // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationMediaUrl validates the protocol and origin.
        ifNode(hasBackgroundVideo, () => h('video', { class: 'presentation-background-media', src: function* () { return safePresentationMediaUrl((yield* presentation.value())?.backgroundUrl ?? ''); }, autoplay: true, muted: true, loop: true, playsinline: true, preload: 'auto', 'aria-hidden': true })),
        div({ class: 'presentation-topbar', 'data-drag-surface': 'topbar' }, presenterMode
          ? [
              a('publicView', { class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.publicView'), 'data-navigation': 'external', href: function* () { return `/present/${yield* presentationId()}`; } }, i18n.t('ui.presentation.publicView')),
              span({ class: 'presentation-brand' }, function* () { return (yield* presentation.value())?.title ?? i18n.t('ui.presentation.loading'); }),
              button('toggleSpeakerNotes', { type: 'button', 'aria-label': i18n.t('ui.presentation.notes'), class: 'presentation-control', click: toggleNotes }, i18n.t('ui.presentation.notes')),
            ]
          : [
              a('exitPresentation', { class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.exit'), 'data-navigation': 'external', href: function* () { return `/editor/${yield* presentationId()}`; } }, i18n.t('ui.presentation.exit')),
              span({ class: 'presentation-brand' }, function* () { return (yield* presentation.value())?.title ?? i18n.t('ui.presentation.loading'); }),
              a('presenterView', { class: 'presentation-control', 'aria-label': i18n.t('ui.presentation.presenterView'), 'data-navigation': 'external', href: function* () { return `/presenter/${yield* presentationId()}`; } }, i18n.t('ui.presentation.presenterView')),
            ]).pipe(dragPresentationSurface),
        ifNode(presentation.isLoading, () => p({ class: 'presentation-loading' }, i18n.t('ui.presentation.loading'))),
        ifNode(overview, () => section({ class: 'presentation-overview', 'data-drag-surface': 'overview', 'data-link-viewer': function* () { return String(yield* hasActiveLink()); }, 'aria-labelledby': 'presentationOverviewTitle' }, [
          h('canvas', { class: 'presentation-overview__canvas', 'aria-hidden': true }).pipe(threePresentationBackdrop),
          ifNode(hasActiveLink, () => section({ class: 'presentation-link-viewer', 'aria-label': i18n.t('ui.presentation.linkViewer') }, [
            div({ class: 'presentation-link-viewer__topbar' }, [
              div({ class: 'presentation-link-viewer__heading' }, [
                span({ class: 'presentation-stage__kicker' }, i18n.t('ui.presentation.linkViewerEyebrow')),
                span({ class: 'presentation-link-viewer__url' }, activeLink),
              ]),
              div({ class: 'presentation-link-viewer__actions' }, [
                a('openPresentationLinkExternal', { class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.openLinkExternal'), href: function* () { return safeUrl((yield* activeLink()) ?? ''); }, target: '_blank', rel: 'noopener noreferrer', 'data-navigation': 'external' }, i18n.t('ui.presentation.openLinkExternal')),
                button('closePresentationLink', { type: 'button', class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.closeLink'), click: closePresentationLink }, i18n.t('ui.presentation.closeLink')),
              ]),
            ]),
            div({ class: 'presentation-link-viewer__frame' }, [
              iframe({ title: i18n.t('ui.presentation.linkViewer'), 'data-source': activeLink, loading: 'eager', referrerPolicy: 'no-referrer', sandbox: 'allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin', allow: 'fullscreen; autoplay; picture-in-picture' }).pipe(embedPresentationLink),
            ]),
          ])),
          ifNode(hasActiveCodeWorkspace, () => section({ class: 'presentation-code-workspace', 'data-terminal-visible': function* () { return String(yield* terminalVisible()); }, 'data-process-status': function* () { return (yield* demoWorkspaceProcessStatus.value())?.state ?? 'stopped'; }, 'aria-label': i18n.t('ui.presentation.codeWorkspace') }, [
            div({ class: 'presentation-code-workspace__topbar' }, [
              div({ class: 'presentation-code-workspace__heading' }, [
                span({ class: 'presentation-stage__kicker' }, i18n.t('ui.presentation.codeWorkspaceEyebrow')),
                span({ class: 'presentation-code-workspace__title' }, function* () { return (yield* demoWorkspace.value())?.title ?? ''; }),
              ]),
              div({ class: 'presentation-link-viewer__actions' }, [
                button('toggleCodeFiles', { type: 'button', class: 'presentation-control presentation-control--quiet', 'aria-label': function* () { return (yield* codeFilesVisible()) ? i18n.t('ui.presentation.hideCodeFiles') : i18n.t('ui.presentation.showCodeFiles'); }, title: function* () { return (yield* codeFilesVisible()) ? i18n.t('ui.presentation.hideCodeFiles') : i18n.t('ui.presentation.showCodeFiles'); }, click: toggleCodeFiles }, i18n.t('ui.presentation.files')),
                button('toggleCodeWorkspaceSearch', { type: 'button', class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.searchCode'), click: function* () { if (yield* codeSearchVisible()) yield* codeSearchVisible.hide(); else { yield* codeFilesVisible.show(); yield* codeSearchVisible.show(); } } }, i18n.t('ui.presentation.searchCode')),
                button('toggleDemoTerminal', { type: 'button', class: 'presentation-control presentation-control--quiet', 'aria-label': function* () { return (yield* terminalVisible()) ? i18n.t('ui.presentation.closeDemoTerminal') : i18n.t('ui.presentation.openDemoTerminal'); }, click: toggleDemoTerminal }, function* () { return (yield* terminalVisible()) ? i18n.t('ui.presentation.closeDemoTerminal') : i18n.t('ui.presentation.openDemoTerminal'); }),
                button('closeCodeWorkspace', { type: 'button', class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.closeCodeWorkspace'), click: closeCodeWorkspace }, i18n.t('ui.presentation.closeCodeWorkspace')),
              ]),
            ]),
            div({ class: 'presentation-code-workspace__body', 'data-files-visible': function* () { return String(yield* codeFilesVisible()); } }, [
              aside({ class: 'presentation-code-workspace__files' }, [
                span({ class: 'presentation-code-workspace__files-title' }, i18n.t('ui.presentation.files')),
                ifNode(codeSearchVisible, () => input('codeWorkspaceSearch', { type: 'search', class: 'presentation-code-workspace__search', 'aria-label': i18n.t('ui.presentation.searchCode'), placeholder: i18n.t('ui.presentation.searchCodePlaceholder'), value: codeSearchQuery, *input(event) { yield* codeSearchQuery.setQuery((event.target as HTMLInputElement).value); } }).pipe(focusCodeWorkspaceInput)),
                ifNode(codeSearchVisible, () => forNode(workspaceSearchMatches, { track: (file) => file.path }, (fileInput) => button('codeSearchResult', { type: 'button', class: 'presentation-code-workspace__file', click: function* () { yield* selectCodeFile((yield* fileInput()).path); } }, function* () { return (yield* fileInput()).path; }))),
                ifNode(codeFileListVisible, () => forNode(visibleWorkspaceFiles, { track: (file) => file.path }, (fileInput) => button('codeWorkspaceFile', { type: 'button', class: 'presentation-code-workspace__file', 'data-active': function* () { return String((yield* selectedWorkspaceFile())?.path === (yield* fileInput()).path); }, click: function* () { yield* selectCodeFile((yield* fileInput()).path); } }, function* () { return (yield* fileInput()).path; }))),
                ifNode(noWorkspaceFiles, () => p({ class: 'presentation-code-workspace__empty' }, i18n.t('ui.presentation.noCodeFiles'))),
              ]),
              div({ class: 'presentation-code-workspace__editor' }, [
                div({ class: 'presentation-code-workspace__tab' }, function* () { return (yield* selectedWorkspaceFile())?.path ?? i18n.t('ui.presentation.noCodeFiles'); }),
                pre('workspaceCode', { class: 'presentation-code presentation-code--workspace', 'data-language': function* () { return (yield* selectedWorkspaceFile())?.language ?? 'typescript'; } }, forNode(highlightedWorkspaceCode, { track: (token) => token.id }, (tokenInput) => span({ class: function* () { return (yield* tokenInput()).className; } }, function* () { return (yield* tokenInput()).text; }))),
              ]),
            ]),
            ifNode(terminalVisible, () => section({ class: 'presentation-demo-terminal', 'aria-label': i18n.t('ui.presentation.demoTerminal'), onDemoWorkspaceProcessRefresh: refreshDemoWorkspaceProcess }, [
              div({ class: 'presentation-demo-terminal__header' }, [
                div({ class: 'presentation-demo-terminal__title' }, [
                  span({ class: 'presentation-stage__kicker' }, i18n.t('ui.presentation.demoTerminalEyebrow')),
                  span({ class: 'presentation-demo-terminal__status', 'data-status': function* () { return (yield* processStatus()).state; }, 'aria-live': 'polite' }, processStatusLabel),
                ]),
                div({ class: 'presentation-demo-terminal__actions' }, [
                  // eslint-disable-next-line craft-ts/no-raw-user-url -- processUrl only contains the validated local demo origin.
                  ifNode(processIsRunning, () => a('openLocalDemo', { class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.openLocalDemo'), href: processUrl, target: '_blank', rel: 'noopener noreferrer', 'data-navigation': 'external' }, i18n.t('ui.presentation.openLocalDemo'))),
                  button('refreshDemoTerminal', { type: 'button', class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.refreshDemoTerminal'), click: refreshDemoWorkspaceProcess }, i18n.t('ui.presentation.refreshDemoTerminal')),
                  button('startDemoTerminal', { type: 'button', class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.startDemo'), disabled: function* () { return (yield* processIsBusy()) || (yield* processIsRunning()); }, click: startDemoWorkspaceProcess }, i18n.t('ui.presentation.startDemo')),
                  button('stopDemoTerminal', { type: 'button', class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.stopDemo'), disabled: function* () { return (yield* processIsBusy()) || !(yield* processIsRunning()); }, click: stopDemoWorkspaceProcess }, i18n.t('ui.presentation.stopDemo')),
                ]),
              ]),
              div({ class: 'presentation-demo-terminal__command' }, [
                span({ class: 'presentation-demo-terminal__prompt', 'aria-hidden': true }, '$'),
                h('code', {}, function* () { return (yield* processStatus()).command; }),
                span({ class: 'presentation-demo-terminal__runtime' }, function* () { return (yield* processStatus()).runtime; }),
              ]),
              div({ class: 'presentation-demo-terminal__input-row' }, [
                span({ class: 'presentation-demo-terminal__prompt', 'aria-hidden': true }, '$'),
                input('demoTerminalCommand', { type: 'text', class: 'presentation-demo-terminal__input', 'aria-label': i18n.t('ui.presentation.demoCommandPlaceholder'), placeholder: i18n.t('ui.presentation.demoCommandPlaceholder'), value: terminalCommand, autocomplete: 'off', spellcheck: false, disabled: function* () { return (yield* terminalIsBusy()) || (yield* processIsBusy()); }, *input(event) { yield* terminalCommand.setCommand((event.target as HTMLInputElement).value); }, *keydown(event) { if (event.key === 'Enter') { event.preventDefault(); yield* runDemoCommand(); } } }),
                button('runDemoCommand', { type: 'button', class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.runDemoCommand'), disabled: function* () { return (yield* terminalIsBusy()) || (yield* processIsBusy()); }, click: runDemoCommand }, i18n.t('ui.presentation.runDemoCommand')),
              ]),
              pre('demoTerminalOutput', { class: 'presentation-demo-terminal__output', 'aria-live': 'polite' }, function* () { return (yield* processStatus()).logs.join('\n'); }),
            ]).pipe(pollDemoWorkspaceProcess)),
            ifNode(codeQuickOpenVisible, () => div({ class: 'presentation-code-workspace__quick-open', role: 'dialog', 'aria-label': i18n.t('ui.presentation.quickOpen') }, [
              div({ class: 'presentation-code-workspace__quick-open-card' }, [
                span({ class: 'presentation-code-workspace__files-title' }, i18n.t('ui.presentation.quickOpen')),
                input('codeWorkspaceQuickOpen', { type: 'search', class: 'presentation-code-workspace__search', 'aria-label': i18n.t('ui.presentation.quickOpen'), placeholder: i18n.t('ui.presentation.quickOpenPlaceholder'), value: codeFileQuery, *input(event) { yield* codeFileQuery.setQuery((event.target as HTMLInputElement).value); } }).pipe(focusCodeWorkspaceInput),
                forNode(visibleWorkspaceFiles, { track: (file) => file.path }, (fileInput) => button('codeQuickOpenResult', { type: 'button', class: 'presentation-code-workspace__file', click: function* () { yield* selectCodeFile((yield* fileInput()).path); } }, function* () { return (yield* fileInput()).path; })),
              ]),
            ])),
          ])),
          ifNode(showOverviewContent, () => [
            div({ class: 'presentation-overview__content' }, [
              // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
              ifNode(hasCoverImage, () => img({ class: 'presentation-overview__image', src: function* () { return safePresentationImageUrl((yield* presentation.value())?.coverImageUrl ?? ''); }, alt: function* () { return (yield* presentation.value())?.coverImageAlt || i18n.t('ui.editor.coverImageAltFallback'); } })),
              span({ class: 'presentation-stage__kicker' }, i18n.t('ui.presentation.overview')),
              heading({ id: 'presentationOverviewTitle', class: 'presentation-overview__title' }, function* () { return (yield* presentation.value())?.title ?? ''; }),
              p({ class: 'presentation-overview__objective' }, function* () { return (yield* presentation.value())?.objective ?? ''; }),
              span({ class: 'presentation-overview__hint' }, i18n.t('ui.presentation.overviewHint')),
            ]),
            div({ class: 'presentation-overview__carousel', role: 'list', 'aria-label': i18n.t('ui.presentation.presentationOutline') }, [
              forNode(sectionNavigation, { track: (part) => part.id }, (partInput) => button('overviewPart', { type: 'button', class: 'presentation-overview__card', 'aria-label': function* () { return `${i18n.t('ui.presentation.selectPart')}: ${(yield* partInput()).title}`; }, click: function* () { yield* selectSlide((yield* partInput()).firstSlideIndex); } }, [
                span({ class: 'presentation-overview__card-index' }, function* () { return String((yield* partInput()).firstSlideIndex + 1).padStart(2, '0'); }),
                span({ class: 'presentation-overview__card-title' }, function* () { return (yield* partInput()).title; }),
                span({ class: 'presentation-overview__card-intention' }, function* () { return (yield* partInput()).intention; }),
                div({ class: 'presentation-overview__card-sequences' }, [
                  forNode(function* () { return (yield* partInput()).sequences; }, { track: (sequence) => sequence.id }, (sequenceInput) => span({ class: 'presentation-overview__sequence' }, function* () { return (yield* sequenceInput()).title; })),
                ]),
              ])),
            ]),
          ]),
        ]).pipe(dragPresentationSurface)),
        ifNode(hasActiveCodeWorkspace, () => div({ class: 'presentation-code-workspace__shortcuts', 'aria-label': i18n.t('ui.presentation.keyboardShortcuts') }, [
          button('dragCodeWorkspaceShortcuts', { type: 'button', class: 'presentation-code-workspace__shortcuts-drag-handle', 'data-drag-surface': 'shortcuts', 'aria-label': i18n.t('ui.presentation.moveKeyboardShortcuts'), title: i18n.t('ui.presentation.moveKeyboardShortcuts') }, '↕').pipe(dragPresentationSurface),
          span({ class: 'presentation-code-workspace__shortcuts-label' }, i18n.t('ui.presentation.keyboardShortcuts')),
          span({ class: 'presentation-code-workspace__shortcut' }, [h('kbd', {}, 'Ctrl/Cmd+P'), span({}, i18n.t('ui.presentation.shortcutQuickOpen'))]),
          span({ class: 'presentation-code-workspace__shortcut' }, [h('kbd', {}, 'Ctrl/Cmd+Shift+F'), span({}, i18n.t('ui.presentation.shortcutSearch'))]),
          span({ class: 'presentation-code-workspace__shortcut' }, [h('kbd', {}, 'Ctrl/Cmd+B'), span({}, i18n.t('ui.presentation.shortcutFiles'))]),
          span({ class: 'presentation-code-workspace__shortcut' }, [h('kbd', {}, 'Esc'), span({}, i18n.t('ui.presentation.shortcutBack'))]),
        ])),
        ifNode(showStage, () => section({ class: 'presentation-stage', tabIndex: -1 }, [
          h('canvas', { class: 'presentation-stage__canvas', 'aria-hidden': true }).pipe(threePresentationBackdrop),
          div({ class: 'presentation-stage__glow' }),
          forNode(
            slideItems,
            { track: (slide) => slide.id },
            () => div({ class: 'presentation-stage__slide', 'data-index': function* () { return String(yield* slideIndex()); }, 'data-transition': function* () { return (yield* currentSlide()).transition; }, style: function* () { return assign(presentationSlideVars.phase, num((yield* slideIndex()) % 2)); } }, [
              span({ class: 'presentation-stage__kicker' }, function* () {
                return `${String((yield* slideIndex()) + 1).padStart(2, '0')} · ${yield* currentSectionTitle()} · ${yield* currentSectionIntention()}`;
              }),
              heading({ class: 'presentation-stage__title', 'aria-label': i18n.t('ui.presentation.currentSlide') }, function* () { return (yield* currentSlide()).title; }),
              p({ class: 'presentation-stage__message' }, function* () { return (yield* currentSlide()).message; }),
              // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
              ifNode(hasImage, () => button('openImageViewer', { type: 'button', class: 'presentation-stage__image-trigger', 'aria-label': i18n.t('ui.presentation.openImageViewer'), title: i18n.t('ui.presentation.openImageViewer'), click: openImageViewer }, img({ class: 'presentation-stage__image', src: function* () { return safePresentationImageUrl((yield* currentSlide()).imageUrl); }, alt: function* () { return (yield* currentSlide()).imageAlt || i18n.t('ui.editor.imageAltFallback'); } }))),
              ifNode(hasCode, () => pre('slideCode', { class: 'presentation-code', 'data-language': function* () { return (yield* currentSlide()).codeLanguage; } }, forNode(highlightedCode, { track: (token) => token.id }, (tokenInput) => span({ class: function* () { return (yield* tokenInput()).className; } }, function* () { return (yield* tokenInput()).text; })))),
              h('canvas', { class: 'presentation-annotation-canvas', 'data-annotation-tool': 'pointer', 'data-annotation-active': 'false', 'aria-hidden': true }).pipe(presentationAnnotationCanvas),
            ]),
          ),
          div({ class: 'presentation-stage__controls' }, [
            button('previousSlide', { type: 'button', 'aria-label': i18n.t('ui.presentation.previous'), title: i18n.t('ui.presentation.previous'), class: 'presentation-control presentation-control--icon', disabled: function* () { return (yield* slideIndex()) === 0; }, click: previous }, span({ 'aria-hidden': true }, '←')),
            div({ class: 'presentation-carousel', role: 'list', 'aria-label': i18n.t('ui.presentation.presentationOutline') }, [
              forNode(sectionNavigation, { track: (part) => part.id }, (partInput) => [
                button('carouselSection', { type: 'button', class: 'presentation-carousel__part', 'data-active': function* () { return String((yield* slideIndex()) >= (yield* partInput()).firstSlideIndex && (yield* slideIndex()) < (yield* partInput()).firstSlideIndex + (yield* partInput()).sequences.length); }, click: function* () { yield* selectSlide((yield* partInput()).firstSlideIndex); } }, function* () { return (yield* partInput()).title; }),
                forNode(function* () { return (yield* partInput()).sequences; }, { track: (sequence) => sequence.id }, (sequenceInput) => button('carouselSequence', { type: 'button', class: 'presentation-carousel__sequence', 'data-active': function* () { return String((yield* sequenceInput()).slideIndex === (yield* slideIndex())); }, click: function* () { yield* selectSlide((yield* sequenceInput()).slideIndex); } }, function* () { return (yield* sequenceInput()).title; })),
              ]),
            ]),
            div({ class: 'presentation-progress' }, [
              div({ class: 'presentation-progress__track', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': progressPercent }, div({ class: 'presentation-progress__fill', style: function* () { return assign(presentationProgressVars.value, unit.pct(yield* progressPercent())); } })),
              span(function* () { return `${(yield* slideIndex()) + 1} / ${(yield* slides()).length}`; }),
            ]),
            button('nextSlide', { type: 'button', 'aria-label': i18n.t('ui.presentation.next'), title: i18n.t('ui.presentation.next'), class: 'presentation-control presentation-control--icon', disabled: function* () { return (yield* slideIndex()) >= (yield* slides()).length - 1; }, click: next }, span({ 'aria-hidden': true }, '→')),
          ]),
        ]).pipe(focusPresentationStage)),
        ifNode(showStage, () => div({ class: 'presentation-annotation-toolbar', role: 'toolbar', 'aria-label': i18n.t('ui.presentation.annotationToolbar') }, [
          button('dragAnnotationToolbar', { type: 'button', class: 'presentation-annotation-toolbar__drag-handle', 'data-drag-surface': 'annotations', 'aria-label': i18n.t('ui.presentation.moveAnnotations'), title: i18n.t('ui.presentation.moveAnnotations') }, '↕').pipe(dragPresentationSurface),
          button('annotationPointer', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-tool': 'pointer', 'data-active': 'true', 'aria-pressed': true, 'aria-label': i18n.t('ui.presentation.annotationPointer'), 'aria-keyshortcuts': presentationAnnotationShortcuts.pointer, title: annotationActionTitle(i18n.t('ui.presentation.annotationPointer'), 'pointer'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationPointer'), 'pointer') }, '↖'),
          button('annotationPen', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-tool': 'pen', 'data-active': 'false', 'aria-pressed': false, 'aria-label': i18n.t('ui.presentation.annotationPen'), 'aria-keyshortcuts': presentationAnnotationShortcuts.pen, title: annotationActionTitle(i18n.t('ui.presentation.annotationPen'), 'pen'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationPen'), 'pen') }, '✎'),
          button('annotationHighlighter', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-tool': 'highlighter', 'data-active': 'false', 'aria-pressed': false, 'aria-label': i18n.t('ui.presentation.annotationHighlighter'), 'aria-keyshortcuts': presentationAnnotationShortcuts.highlighter, title: annotationActionTitle(i18n.t('ui.presentation.annotationHighlighter'), 'highlighter'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationHighlighter'), 'highlighter') }, '▰'),
          button('annotationArrow', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-tool': 'arrow', 'data-active': 'false', 'aria-pressed': false, 'aria-label': i18n.t('ui.presentation.annotationArrow'), 'aria-keyshortcuts': presentationAnnotationShortcuts.arrow, title: annotationActionTitle(i18n.t('ui.presentation.annotationArrow'), 'arrow'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationArrow'), 'arrow') }, '↗'),
          button('annotationRectangle', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-tool': 'rectangle', 'data-active': 'false', 'aria-pressed': false, 'aria-label': i18n.t('ui.presentation.annotationRectangle'), 'aria-keyshortcuts': presentationAnnotationShortcuts.rectangle, title: annotationActionTitle(i18n.t('ui.presentation.annotationRectangle'), 'rectangle'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationRectangle'), 'rectangle') }, '□'),
          button('annotationEraser', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-tool': 'eraser', 'data-active': 'false', 'aria-pressed': false, 'aria-label': i18n.t('ui.presentation.annotationEraser'), 'aria-keyshortcuts': presentationAnnotationShortcuts.eraser, title: annotationActionTitle(i18n.t('ui.presentation.annotationEraser'), 'eraser'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationEraser'), 'eraser') }, '⌫'),
          span({ class: 'presentation-annotation-toolbar__separator', 'aria-hidden': true }),
          button('annotationUndo', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-action': 'undo', 'aria-label': i18n.t('ui.presentation.annotationUndo'), 'aria-keyshortcuts': presentationAnnotationShortcuts.undo, title: annotationActionTitle(i18n.t('ui.presentation.annotationUndo'), 'undo'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationUndo'), 'undo'), disabled: true }, '↶'),
          button('annotationClear', { type: 'button', class: 'presentation-control presentation-control--icon', 'data-annotation-action': 'clear', 'aria-label': i18n.t('ui.presentation.annotationClear'), 'aria-keyshortcuts': presentationAnnotationShortcuts.clear, title: annotationActionTitle(i18n.t('ui.presentation.annotationClear'), 'clear'), 'data-tooltip': annotationActionTitle(i18n.t('ui.presentation.annotationClear'), 'clear'), disabled: true }, '✕'),
        ]).pipe(presentationAnnotationToolbar)),
        ifNode(hasImageViewer, () => div({ class: 'presentation-image-viewer', role: 'dialog', 'aria-modal': true, 'aria-label': i18n.t('ui.presentation.imageViewer'), tabIndex: -1 }, [
          div({ class: 'presentation-image-viewer__toolbar' }, [
            span({ class: 'presentation-image-viewer__title' }, i18n.t('ui.presentation.imageViewer')),
            div({ class: 'presentation-image-viewer__actions' }, [
              button('zoomOutImage', { type: 'button', class: 'presentation-image-viewer__control', 'data-image-viewer-action': 'zoom-out', 'aria-label': i18n.t('ui.presentation.zoomOut'), title: i18n.t('ui.presentation.zoomOut') }, '−'),
              span({ class: 'presentation-image-viewer__zoom-value', 'aria-live': 'polite' }, '100%'),
              button('zoomInImage', { type: 'button', class: 'presentation-image-viewer__control', 'data-image-viewer-action': 'zoom-in', 'aria-label': i18n.t('ui.presentation.zoomIn'), title: i18n.t('ui.presentation.zoomIn') }, '+'),
              button('resetImageZoom', { type: 'button', class: 'presentation-image-viewer__control presentation-image-viewer__control--reset', 'data-image-viewer-action': 'reset', 'aria-label': i18n.t('ui.presentation.resetZoom'), title: i18n.t('ui.presentation.resetZoom') }, '↺'),
              button('closeImageViewer', { type: 'button', class: 'presentation-image-viewer__control presentation-image-viewer__control--close', 'aria-label': i18n.t('ui.presentation.closeImageViewer'), title: i18n.t('ui.presentation.closeImageViewer'), click: closeImageViewer }, '×'),
            ]),
          ]),
          div({ class: 'presentation-image-viewer__viewport' }, [
            // eslint-disable-next-line craft-ts/no-raw-user-url -- safePresentationImageUrl validates and drops blocked origins.
            img({ class: 'presentation-image-viewer__image', src: function* () { return (yield* imageViewer())?.url ?? ''; }, alt: function* () { return (yield* imageViewer())?.alt ?? ''; }, draggable: false }),
          ]),
          p({ class: 'presentation-image-viewer__hint' }, i18n.t('ui.presentation.imageZoomHint')),
        ]).pipe(imageViewerInteraction)),
        ifNode(showNotes, () => section({ class: 'presentation-notes' }, [
          div({ class: 'presentation-notes__header' }, [
            span({ class: 'studio-panel__label' }, i18n.t('ui.presentation.speakerNotes')),
            div({ class: 'presentation-notes__actions' }, [
              ifNode(hasDemoWorkspace, () => button('openCodeWorkspace', { type: 'button', class: 'presentation-control presentation-control--quiet', 'aria-label': i18n.t('ui.presentation.openCodeWorkspace'), click: openCodeWorkspace }, i18n.t('ui.presentation.openCodeWorkspace'))),
              ifNode(hasDemoWorkspace, () => button('openDemoTerminal', { type: 'button', class: 'presentation-control presentation-control--primary', 'aria-label': i18n.t('ui.presentation.openDemoTerminal'), click: openDemoTerminal }, i18n.t('ui.presentation.openDemoTerminal'))),
              button('dragSpeakerNotes', { type: 'button', class: 'presentation-notes__drag-handle', 'data-drag-surface': 'notes', 'aria-label': i18n.t('ui.presentation.moveNotes'), title: i18n.t('ui.presentation.moveNotes') }, '↕').pipe(dragPresentationSurface),
            ]),
          ]),
          div({ class: 'presentation-notes__body' }, [
            forNode(noteParts, { track: (part) => part.id }, (notePartInput) => matchNode.exhaustive(notePartInput, 'kind', {
              link: (part) => a('speakerNoteLink', { 'aria-label': part.text, href: safeUrl(part.url), 'data-navigation': 'external', click: function* (event) { event.preventDefault(); yield* openPresentationLink(part.url); } }, part.text),
              text: (part) => span(part.text),
            })),
          ]),
        ])),
      ]).pipe(applyPresentationGradient).pipe(focusPresentationStage),
  );
}

export const PresentationPage = createPresentationPage('PresentationPage', false);
export const PresenterPage = createPresentationPage('PresenterPage', true);
