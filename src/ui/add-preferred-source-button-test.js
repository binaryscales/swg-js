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

import {AddPreferredSourceButton} from './add-preferred-source-button';
import {AddPreferredSourceStatus, AnalyticsEvent} from '../proto/api_messages';
import {ConfiguredRuntime} from '../runtime/runtime';
import {PageConfig} from '../model/page-config';

describes.realWin('AddPreferredSourceButton', (env) => {
  let win;
  let runtime;
  let container;
  let eventManagerMock;

  beforeEach(() => {
    win = env.win;
    container = win.document.createElement('div');
    win.document.body.appendChild(container);

    const pageConfig = new PageConfig('pub1', true);
    runtime = new ConfiguredRuntime(win, pageConfig);
    eventManagerMock = {
      logEvent: sandbox.spy(),
    };
    sandbox.stub(runtime, 'eventManager').returns(eventManagerMock);
  });

  afterEach(() => {
    if (container.parentElement) {
      container.parentElement.removeChild(container);
    }
  });

  it('should attach shadow DOM and render light theme button by default', () => {
    const button = new AddPreferredSourceButton(runtime, container);
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    expect(eventManagerMock.logEvent).to.have.been.calledWith(
      sandbox.match({
        eventType: AnalyticsEvent.IMPRESSION_ADD_PREFERRED_SOURCES_BUTTON,
      })
    );

    const buttonEl = container.shadowRoot || button['buttonEl_'];
    expect(buttonEl).to.not.be.null;
    expect(buttonEl.textContent).to.include('Add to Preferred Sources');
  });

  it('should return null for getShadowRoot before attach, and ShadowRoot after attach', () => {
    const button = new AddPreferredSourceButton(runtime, container);
    expect(button.getShadowRoot()).to.be.null;

    button.attach(sandbox.spy());
    expect(button.getShadowRoot()).to.not.be.null;
    expect(button.getShadowRoot().querySelector('.publisher-btn')).to.not.be
      .null;
  });

  it('should fallback to global document if container has no ownerDocument', () => {
    const fakeContainer = {
      attachShadow: sandbox.stub().returns(win.document.createElement('div')),
    };
    const button = new AddPreferredSourceButton(runtime, fakeContainer);
    button.attach(sandbox.spy());
    expect(fakeContainer.attachShadow).to.have.been.calledOnce;
  });

  it('should render dark theme styles when theme is dark', () => {
    const button = new AddPreferredSourceButton(runtime, container, {
      theme: 'dark',
    });
    button.attach(sandbox.spy());

    const shadow = button.getShadowRoot();
    const styleEl = shadow.querySelector('style');
    expect(styleEl.textContent).to.include('#202124');
    expect(styleEl.textContent).to.include('#5f6368');
  });

  it('should render localized text for specified language', () => {
    const button = new AddPreferredSourceButton(runtime, container, {
      lang: 'es',
    });
    button.attach(sandbox.spy());

    const textEl = button['textEl_'];
    expect(textEl.textContent).to.equal(
      'Añadir a Fuentes preferidas de Google'
    );
  });

  it('should handle click event, log analytics, and execute callback', () => {
    const button = new AddPreferredSourceButton(runtime, container);
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    const buttonEl = button['buttonEl_'];
    buttonEl.dispatchEvent(new win.MouseEvent('click'));

    expect(eventManagerMock.logEvent).to.have.been.calledWith(
      sandbox.match({
        eventType: AnalyticsEvent.ACTION_ADD_PREFERRED_SOURCES_BUTTON_CLICK,
        isFromUserAction: true,
      })
    );
    expect(clickHandler).to.have.been.calledOnce;
  });

  it('should update to success state when status is SUCCESS', () => {
    const button = new AddPreferredSourceButton(runtime, container);
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
    );

    const buttonEl = button['buttonEl_'];
    const textEl = button['textEl_'];
    const logoWrapper = buttonEl.querySelector('.publisher-logo-wrapper');

    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(textEl.textContent).to.equal('Added to Preferred Sources');
    expect(logoWrapper.innerHTML).to.include('publisher-logo');

    // Clicks should be ignored when disabled
    clickHandler.resetHistory();
    buttonEl.dispatchEvent(new win.MouseEvent('click'));
    expect(clickHandler).to.not.have.been.called;
  });

  it('should update to success state when status is ALREADY_ADDED', () => {
    const button = new AddPreferredSourceButton(runtime, container, {
      lang: 'de',
    });
    button.attach(sandbox.spy());

    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED
    );

    const buttonEl = button['buttonEl_'];
    const textEl = button['textEl_'];

    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(textEl.textContent).to.equal(
      'Zu den bevorzugten Quellen in der Google Suche hinzugefügt'
    );
  });

  it('should update to disabled state when status is INELIGIBLE', () => {
    const button = new AddPreferredSourceButton(runtime, container);
    const clickHandler = sandbox.spy();
    button.attach(clickHandler);

    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_INELIGIBLE
    );

    const buttonEl = button['buttonEl_'];
    const textEl = button['textEl_'];

    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(textEl.textContent).to.equal('Add to Preferred Sources');

    buttonEl.dispatchEvent(new win.MouseEvent('click'));
    expect(clickHandler).to.not.have.been.called;
  });

  it('should apply initial status if updateStatus is called before attach', () => {
    const button = new AddPreferredSourceButton(runtime, container);
    button.updateStatus(
      AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS
    );
    button.attach(sandbox.spy());

    const buttonEl = button['buttonEl_'];
    const textEl = button['textEl_'];

    expect(buttonEl.getAttribute('aria-disabled')).to.equal('true');
    expect(textEl.textContent).to.equal('Added to Preferred Sources');
  });
});
