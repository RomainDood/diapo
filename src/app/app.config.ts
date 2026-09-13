import {
  provideCraftRootComponent,
  provideSendContextToAi,
} from "@craft-ts/component";
import {
  craftAppConfig,
  CRAFT_SECURITY_POLICY,
  createCraftSecurityPolicy,
  provideAppInitializer,
  provideCraftDevTools,
  provideCraftRouter,
} from "@craft-ts/core";
import { installCraftEffectBridge, provideLayer } from "@craft-ts/effect";
import { App } from "./app";
import { appRoutes } from "./app.routes";
import { i18nLayer } from "../i18n/effect-layer";
import { PRESENTATION_IMAGE_ALLOWED_ORIGINS } from "../shared/presentation";

const effectProviders = provideLayer(i18nLayer);
const developmentProviders = import.meta.env.DEV ? provideCraftDevTools() : [];
function providerDebugName(provider: unknown): string | undefined {
  if (!provider || typeof provider !== 'object' || Array.isArray(provider) || !('provide' in provider)) return undefined;
  const token = provider.provide;
  if (!token || typeof token !== 'object' || !('debugName' in token)) return undefined;
  return typeof token.debugName === 'string' ? token.debugName : undefined;
}

// The 0.8.5 send-context HTTP trace adapter leaves CraftHttpClient requests
// pending. Keep the context UI and other event sources, but omit that adapter
// so server-backed queries can settle normally.
const sendContextProviders = provideSendContextToAi().filter((provider) =>
  providerDebugName(provider) !== 'CRAFT_HTTP_TRACE',
);

export const appConfig = craftAppConfig({
  providers: [
    ...developmentProviders,
    provideCraftRootComponent(App),
    provideCraftRouter(appRoutes.toRoutes()),
    {
      provide: CRAFT_SECURITY_POLICY,
      useValue: createCraftSecurityPolicy({
        dom: {
          allowedResourceOrigins: PRESENTATION_IMAGE_ALLOWED_ORIGINS,
        },
      }),
    },

    effectProviders,
    provideAppInitializer(() => installCraftEffectBridge()),
    ...sendContextProviders,
  ],
});

// Keep all application layers inside one provider: provideLayer replaces the
// level when registered twice, so separate providers would drop one layer.
