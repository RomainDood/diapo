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

export const appConfig = craftAppConfig({
  routingDeps: appRoutes.META_PATHS,
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
    provideSendContextToAi(),
  ],
});

// Keep all application layers inside one provider: provideLayer replaces the
// level when registered twice, so separate providers would drop one layer.
