/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  AddPreferredSourceStatus,
  AnalyticsEvent,
  EventParams,
} from '../proto/api_messages';
import {ConfiguredRuntime} from '../runtime/runtime';
import {GOOGLE_G_LOGO_URL} from '../utils/assets';
import {I18N_STRINGS} from '../i18n/strings';
import {PreferredSourceButtonOptions} from '../api/preferred-source';
import {
  SWG_OUTLINED_BUTTON_TAG,
  defineSwgMaterialElements,
} from './material-web-components';
import {createElement} from '../utils/dom';
import {getButtonStyles} from './add-preferred-source-button-templates';
import {getCanonicalUrl} from '../utils/url';
import {msg} from '../utils/i18n';

export class AddPreferredSourceButton {
  private shadow_: ShadowRoot | null = null;
  private buttonEl_: HTMLElement | null = null;
  private textEl_: HTMLSpanElement | null = null;
  private currentStatus_?: AddPreferredSourceStatus;

  constructor(
    private readonly runtime_: ConfiguredRuntime,
    private readonly container_: HTMLElement,
    private readonly options_: PreferredSourceButtonOptions = {}
  ) {
    defineSwgMaterialElements();
  }

  getShadowRoot(): ShadowRoot | null {
    return this.shadow_;
  }

  attach(clickHandler: () => Promise<boolean>): void {
    const doc = this.container_.ownerDocument || document;
    const shadow = this.container_.attachShadow({mode: 'closed'});
    this.shadow_ = shadow;

    const isDark = this.options_.theme === 'dark';
    const lang = this.options_.lang || 'en';
    const initialText = msg(I18N_STRINGS.ADD_PREFERRED_SOURCE_BUTTON, lang);

    // 1. Inject encapsulated shadow style sheet.
    const styleEl = createElement<HTMLStyleElement>(
      doc,
      'style',
      {},
      getButtonStyles(isDark)
    );
    shadow.appendChild(styleEl);

    // 2. Build Material 3 Outlined Button element.
    const buttonEl = createElement<HTMLElement>(doc, SWG_OUTLINED_BUTTON_TAG, {
      'aria-live': 'polite',
    });
    this.buttonEl_ = buttonEl;

    // 3. Build logo and text nodes.
    const logoEl = createElement<HTMLImageElement>(doc, 'img', {
      'class': 'publisher-logo',
      'slot': 'icon',
      'src': GOOGLE_G_LOGO_URL,
      'alt': 'Google',
      'width': '22',
      'height': '22',
      'loading': 'eager',
      'decoding': 'async',
    });

    const textEl = createElement<HTMLSpanElement>(
      doc,
      'span',
      {'class': 'publisher-btn-text'},
      initialText
    );
    this.textEl_ = textEl;

    buttonEl.appendChild(logoEl);
    buttonEl.appendChild(textEl);
    shadow.appendChild(buttonEl);

    // 4. Attach click listener.
    buttonEl.addEventListener('click', (e) => {
      e.preventDefault();
      if (
        buttonEl.hasAttribute('disabled') ||
        buttonEl.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }
      this.logClickEvent_();
      clickHandler();
    });

    // 5. Log impression event.
    this.logImpressionEvent_();

    // 6. If an initial status was set before attach, apply it.
    if (this.currentStatus_ !== undefined) {
      this.updateStatus(this.currentStatus_);
    }
  }

  updateStatus(status: AddPreferredSourceStatus): void {
    this.currentStatus_ = status;
    const lang = this.options_.lang || 'en';

    if (!this.buttonEl_ || !this.textEl_) {
      return;
    }

    if (
      status === AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS ||
      status ===
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
    ) {
      this.buttonEl_.setAttribute('disabled', '');
      this.buttonEl_.setAttribute('aria-disabled', 'true');
      this.textEl_.textContent = msg(
        I18N_STRINGS.ADDED_TO_PREFERRED_SOURCES_BUTTON,
        lang
      );
    } else if (
      status === AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
    ) {
      this.buttonEl_.setAttribute('disabled', '');
      this.buttonEl_.setAttribute('aria-disabled', 'true');
      this.textEl_.textContent = msg(
        I18N_STRINGS.ADD_PREFERRED_SOURCE_BUTTON,
        lang
      );
    }
  }

  private logImpressionEvent_(): void {
    const eventParams = new EventParams();
    const canonicalUrl = getCanonicalUrl(this.runtime_.doc());
    if (canonicalUrl) {
      eventParams.setCanonicalUrl(canonicalUrl);
    }
    if (this.currentStatus_ !== undefined) {
      eventParams.setAddPreferredSourceStatus(this.currentStatus_);
    }
    this.runtime_.eventManager().logEvent({
      eventType: AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
      eventOriginator: 1, // SWG_CLIENT
      isFromUserAction: false,
      additionalParameters: eventParams,
    });
  }

  private logClickEvent_(): void {
    const eventParams = new EventParams();
    const canonicalUrl = getCanonicalUrl(this.runtime_.doc());
    if (canonicalUrl) {
      eventParams.setCanonicalUrl(canonicalUrl);
    }
    this.runtime_.eventManager().logEvent({
      eventType: AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCES_BUTTON_CLICK,
      eventOriginator: 1, // SWG_CLIENT
      isFromUserAction: true,
      additionalParameters: eventParams,
    });
  }
}
