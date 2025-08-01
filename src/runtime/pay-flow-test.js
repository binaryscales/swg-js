/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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
  AccountCreationRequest,
  AnalyticsEvent,
  CtaMode,
  EntitlementsResponse,
  EventParams,
} from '../proto/api_messages';
import {ActivityIframeView} from '../ui/activity-iframe-view';
import {ClientConfig} from '../model/client-config';
import {ConfiguredRuntime} from './runtime';
import {Entitlements} from '../api/entitlements';
import {MockActivityPort} from '../../test/mock-activity-port';
import {PageConfig} from '../model/page-config';
import {PayClient} from './pay-client';
import {
  PayCompleteFlow,
  PayStartFlow,
  RecurrenceMapping,
  ReplaceSkuProrationModeMapping,
  parseEntitlements,
  parseSubscriptionResponse,
  parseUserData,
} from './pay-flow';
import {
  ProductType,
  ReplaceSkuProrationMode,
  SubscriptionFlows,
} from '../api/subscriptions';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {StorageKeys} from '../utils/constants';
import {UserData} from '../api/user-data';
import {createElement} from '../utils/dom';
import {tick} from '../../test/tick';

const INTEGR_DATA_STRING =
  'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
  'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
  'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
  'VUMHNpZlEuU0lHIiwic2lnbmVkRW50aXRsZW1lbnRzIjoiZXlKaGJHY2lPaUpJVXpJMU5p' +
  'SXNJblI1Y0NJNklrcFhWQ0o5LmV5SmxiblJwZEd4bGJXVnVkSE1pT2x0N0luTnZkWEpqWl' +
  'NJNklsUkZVMVFpZlYxOS5TSUcifX0=';

const INTEGR_DATA_STRING_NO_ENTITLEMENTS =
  'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
  'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
  'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
  'VUMHNpZlEuU0lHIn19';

const EMPTY_ID_TOK =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJJRF9UT0sifQ.SIG';

const ENTITLEMENTS_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJlbnRpdGxlbWVudHMiOlt7InNvdXJjZSI6IlRFU1QifV19.SIG';

const INTEGR_DATA_OBJ = {
  'integratorClientCallbackData': INTEGR_DATA_STRING,
};

const INTEGR_DATA_OBJ_NO_ENTITLEMENTS = {
  'integratorClientCallbackData': INTEGR_DATA_STRING_NO_ENTITLEMENTS,
};

const INTEGR_DATA_OBJ_DECODED = {
  'swgCallbackData': {
    'purchaseData': '{"orderId":"ORDER"}',
    'purchaseDataSignature': 'PD_SIG',
    'idToken': EMPTY_ID_TOK,
    'signedEntitlements': ENTITLEMENTS_JWT,
  },
};

const INTEGR_DATA_OBJ_DECODED_NO_ENTITLEMENTS = {
  'swgCallbackData': {
    'purchaseData': '{"orderId":"ORDER"}',
    'purchaseDataSignature': 'PD_SIG',
    'idToken': EMPTY_ID_TOK,
  },
};

/**
 * @param {string} sku
 * @param {string=} subscriptionFlow
 * @param {CtaMode} ctaMode
 * @return {!EventParams}
 */
function getEventParams(
  sku,
  subscriptionFlow = null,
  ctaMode = CtaMode.CTA_MODE_POPUP
) {
  return new EventParams([, , , , sku, , , subscriptionFlow, , , , ctaMode]);
}

const USER_ID_TOKEN = 'ID_TOK';
const USER_EMAIL = 'test@example.org';
const SERVICE_NAME = 'service1';
const RAW_ENTITLEMENTS = 'RaW';

/** @return {!UserData} */
function createDefaultUserData() {
  return new UserData(USER_ID_TOKEN, {'email': USER_EMAIL});
}

/** @return {!SubscribeResponse} */
function createDefaultSubscribeResponse() {
  const purchaseData = new PurchaseData();
  const userData = createDefaultUserData();
  const entitlements = new Entitlements(
    SERVICE_NAME,
    RAW_ENTITLEMENTS,
    [],
    null
  );
  return new SubscribeResponse(
    RAW_ENTITLEMENTS,
    purchaseData,
    userData,
    entitlements,
    ProductType.SUBSCRIPTION,
    null
  );
}

describes.realWin('PayStartFlow', (env) => {
  let win;
  let pageConfig;
  let runtime;
  let payClientMock;
  let dialogManagerMock;
  let callbacksMock;
  let flow;
  let analyticsMock;
  let eventManagerMock;
  let clientConfigManagerMock;
  const productTypeRegex = /^(SUBSCRIPTION|UI_CONTRIBUTION)$/;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    payClientMock = sandbox.mock(runtime.payClient());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    callbacksMock = sandbox.mock(runtime.callbacks());
    analyticsMock = sandbox.mock(runtime.analytics());
    eventManagerMock = sandbox.mock(runtime.eventManager());
    clientConfigManagerMock = sandbox.mock(runtime.clientConfigManager());
    flow = new PayStartFlow(runtime, {'skuId': 'sku1'});
  });

  afterEach(() => {
    clientConfigManagerMock.verify();
    payClientMock.verify();
    dialogManagerMock.verify();
    callbacksMock.verify();
    analyticsMock.verify();
    eventManagerMock.verify();
  });

  it('should have valid flow constructed in payStartFlow', async () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('subscribe', {skuId: 'sku1'})
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            skuId: 'sku1',
            publicationId: 'pub1',
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('sku1')
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PLAY_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_POPUP)
      );
    await flow.start();
  });

  it('should trigger the contribution flow if given contribution productType', async () => {
    const subscriptionRequest = {
      skuId: 'sku1',
      publicationId: 'pub1',
    };
    const contribFlow = new PayStartFlow(
      runtime,
      subscriptionRequest,
      ProductType.UI_CONTRIBUTION
    );
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('contribute', subscriptionRequest)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': subscriptionRequest,
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('sku1')
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PLAY_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('')
      );
    await contribFlow.start();
  });

  it('should have valid flow constructed for one time', async () => {
    const subscriptionRequest = {
      skuId: 'newSku',
      oneTime: true,
      publicationId: 'pub1',
    };
    const oneTimeFlow = new PayStartFlow(runtime, subscriptionRequest);
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('subscribe', subscriptionRequest)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            skuId: 'newSku',
            paymentRecurrence: RecurrenceMapping['ONE_TIME'],
            publicationId: 'pub1',
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('newSku')
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PLAY_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('')
      );
    await oneTimeFlow.start();
  });

  it('should have valid flow constructed with metadata', async () => {
    const subscriptionRequest = {
      skuId: 'newSku',
      publicationId: 'pub1',
      metadata: {
        test: 'test',
      },
    };
    const metadataFlow = new PayStartFlow(runtime, subscriptionRequest);
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('subscribe', subscriptionRequest)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            skuId: 'newSku',
            publicationId: 'pub1',
            metadata: {
              test: 'test',
            },
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('newSku')
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PLAY_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('')
      );
    await metadataFlow.start();
  });

  it('should have valid replace flow constructed', async () => {
    const subscriptionRequest = {
      skuId: 'newSku1',
      oldSku: 'oldSku1',
      publicationId: 'pub1',
      replaceSkuProrationMode:
        ReplaceSkuProrationMode.IMMEDIATE_WITH_TIME_PRORATION,
    };
    const replaceFlow = new PayStartFlow(runtime, subscriptionRequest);
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('subscribe', subscriptionRequest)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    analyticsMock.expects('setSku').withExactArgs('oldSku1');
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            skuId: 'newSku1',
            oldSku: 'oldSku1',
            publicationId: 'pub1',
            replaceSkuProrationMode:
              ReplaceSkuProrationModeMapping.IMMEDIATE_WITH_TIME_PRORATION,
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('newSku1')
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PLAY_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('')
      );
    await replaceFlow.start();
  });

  it('should have valid replace flow constructed (no proration mode)', async () => {
    const subscriptionRequest = {
      skuId: 'newSku2',
      oldSku: 'oldSku2',
      publicationId: 'pub1',
    };
    const replaceFlowNoProrationMode = new PayStartFlow(
      runtime,
      subscriptionRequest
    );
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(Promise.resolve(new ClientConfig({useUpdatedOfferFlows: true})));
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('subscribe', subscriptionRequest)
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': Object.assign({}, subscriptionRequest, {
            replaceSkuProrationMode:
              ReplaceSkuProrationModeMapping.IMMEDIATE_WITH_TIME_PRORATION,
          }),
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    analyticsMock.expects('setSku').withExactArgs('oldSku2');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('newSku2')
      );
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.ACTION_PAY_PAYMENT_FLOW_STARTED,
        true,
        getEventParams('')
      );
    await replaceFlowNoProrationMode.start();
  });

  it('should force redirect mode', async () => {
    runtime.configure({windowOpenMode: 'redirect'});
    payClientMock
      .expects('start')
      .withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            'publicationId': 'pub1',
            'skuId': 'sku1',
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: true,
          forceDisableNative: false,
        }
      )
      .once();
    await flow.start();
  });

  it('should have paySwgVersion from clientConfig', async () => {
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(new ClientConfig({paySwgVersion: '1'}))
      .once();

    payClientMock
      .expects('start')
      .withArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            'skuId': 'sku1',
            'publicationId': 'pub1',
            'swgVersion': '1',
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: false,
        }
      )
      .once();
    await flow.start();
  });

  it('should forceDisableNative for basic paySwgVersion', async () => {
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(new ClientConfig({paySwgVersion: '2'}))
      .once();

    payClientMock
      .expects('start')
      .withArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': 'TEST',
          'playEnvironment': 'STAGING',
          'swg': {
            'skuId': 'sku1',
            'publicationId': 'pub1',
            'swgVersion': '2',
          },
          'i': {
            'startTimeMs': sandbox.match.any,
            'productType': sandbox.match(productTypeRegex),
          },
        },
        {
          forceRedirect: false,
          forceDisableNative: true,
        }
      )
      .once();
    await flow.start();
  });
});

describes.realWin('PayCompleteFlow', (env) => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let entitlementsManagerMock;
  let responseCallback;
  let flow;
  let analyticsMock;
  let eventManagerMock;
  let jserrorMock;
  let port;
  let messageLabel;
  let messageMap;
  let storageMock;
  let clientConfigManagerMock;

  const TOKEN_HEADER = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  const TOKEN_PAYLOAD =
    'eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4g4K-1' +
    'WuWKoOSFjOCoh-KYjsOIypjYut6dIiwiYWRtaW4iOnRydWV9';
  const TOKEN_SIG = 'TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ';
  const TOKEN = `${TOKEN_HEADER}.${TOKEN_PAYLOAD}.${TOKEN_SIG}`;
  const WINDOW_LOCATION_DOMAIN = 'https://www.test.com';

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    responseCallback = null;
    sandbox.stub(PayClient.prototype, 'onResponse').callsFake((callback) => {
      responseCallback = callback;
    });
    messageMap = {};
    runtime = new ConfiguredRuntime(win, pageConfig);
    analyticsMock = sandbox.mock(runtime.analytics());
    jserrorMock = sandbox.mock(runtime.jserror());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    eventManagerMock = sandbox.mock(runtime.eventManager());
    storageMock = sandbox.mock(runtime.storage());
    clientConfigManagerMock = sandbox.mock(runtime.clientConfigManager());

    sandbox.stub(runtime, 'win').returns({
      location: {href: WINDOW_LOCATION_DOMAIN + '/page/1'},
      document: win.document,
    });

    flow = new PayCompleteFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    entitlementsManagerMock.verify();
    analyticsMock.verify();
    jserrorMock.verify();
    eventManagerMock.verify();
    storageMock.verify();
    clientConfigManagerMock.verify();
    expect(PayClient.prototype.onResponse).to.be.calledOnce;
  });

  it('should have valid flow constructed', async () => {
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          idToken: USER_ID_TOKEN,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
  });

  it(
    'triggers the payConfirmedOpened callback when dialog opens after flow' +
      'start',
    async () => {
      const response = createDefaultSubscribeResponse();
      entitlementsManagerMock
        .expects('pushNextEntitlements')
        .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
        .once();
      port = new MockActivityPort();
      port.onResizeRequest = () => {};
      port.whenReady = () => Promise.resolve();

      callbacksMock
        .expects('triggerPayConfirmOpened')
        .withExactArgs(
          sandbox.match((arg) => {
            expect(arg instanceof ActivityIframeView).to.be.true;
            return true;
          })
        )
        .once();

      activitiesMock
        .expects('openIframe')
        .withExactArgs(sandbox.match.any, sandbox.match.any, sandbox.match.any)
        .resolves(port);

      await flow.start(response);
      await flow.readyPromise_;
    }
  );

  it('should have valid flow constructed w/o entitlements', async () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = createDefaultUserData();
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      null,
      ProductType.SUBSCRIPTION,
      null
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          loginHint: USER_EMAIL,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('should have valid flow constructed w/ oldSku', async () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = createDefaultUserData();
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      null,
      ProductType.SUBSCRIPTION,
      null,
      'sku_to_replace'
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          loginHint: USER_EMAIL,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: true,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('should have valid flow constructed w/ one time contributions', async () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = createDefaultUserData();
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      null,
      ProductType.UI_CONTRIBUTION,
      null,
      null,
      null,
      2
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          loginHint: USER_EMAIL,
          productType: ProductType.UI_CONTRIBUTION,
          isSubscriptionUpdate: false,
          isOneTime: true,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('should have valid flow constructed w/ user token', async () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = createDefaultUserData();
    const entitlements = new Entitlements(
      SERVICE_NAME,
      RAW_ENTITLEMENTS,
      [],
      null
    );
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      entitlements,
      ProductType.SUBSCRIPTION,
      null,
      null,
      '123', // swgUserToken
      null
    );
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          idToken: USER_ID_TOKEN,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);

    storageMock
      .expects('set')
      .withExactArgs(StorageKeys.USER_TOKEN, '123', true);

    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
  });

  it('should have valid flow constructed w/ useUpdatedConfirmUi set to true', async () => {
    clientConfigManagerMock
      .expects('getClientConfig')
      .resolves(new ClientConfig({useUpdatedOfferFlows: true}))
      .once();

    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          idToken: USER_ID_TOKEN,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: true,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
  });

  it('should have valid flow with skipAccountCreationScreen true', async () => {
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(
        Promise.resolve(new ClientConfig({skipAccountCreationScreen: true}))
      )
      .once();
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          idToken: USER_ID_TOKEN,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: true,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
  });

  it('constructs valid flow with forced language params', async () => {
    clientConfigManagerMock
      .expects('shouldForceLangInIframes')
      .returns(true)
      .once();
    clientConfigManagerMock.expects('getLanguage').returns('fr-CA').once();
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      );

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_&hl=fr-CA',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          idToken: USER_ID_TOKEN,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('should complete the flow', async () => {
    const response = createDefaultSubscribeResponse();
    const port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock
      .expects('reset')
      .withExactArgs(true) // Expected positive.
      .once();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();
    const params = getEventParams('');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED, true, params);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ACCOUNT_CREATED, true, params);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED, true, params);
    const messageStub = sandbox.stub(port, 'execute');

    await flow.start(response);
    await flow.complete();
    const accountCreationRequest = new AccountCreationRequest();
    accountCreationRequest.setComplete(true);
    expect(messageStub).to.be.calledOnce.calledWith(accountCreationRequest);
  });

  it('should complete the flow without account creation if skipAccountCreationScreen: true', async () => {
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(
        Promise.resolve(new ClientConfig({skipAccountCreationScreen: true}))
      )
      .once();
    const response = createDefaultSubscribeResponse();
    const port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock
      .expects('reset')
      .withExactArgs(true) // Expected positive.
      .once();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();

    await flow.start(response);
    clientConfigManagerMock
      .expects('getClientConfig')
      .returns(
        Promise.resolve(new ClientConfig({skipAccountCreationScreen: true}))
      )
      .once();
    await flow.complete();
  });

  it('should complete the flow w/o entitlements', async () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = createDefaultUserData();
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      null,
      ProductType.SUBSCRIPTION,
      null
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').resolves(port);
    entitlementsManagerMock
      .expects('reset')
      .withExactArgs(true) // Expected positive.
      .once();
    entitlementsManagerMock.expects('pushNextEntitlements').never();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();
    const params = getEventParams('');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ACCOUNT_CREATED, true, params);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED, true, params);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED, true, params);
    const messageStub = sandbox.stub(port, 'execute');

    await flow.start(response);
    await flow.complete();
    const accountCreationRequest = new AccountCreationRequest();
    accountCreationRequest.setComplete(true);
    expect(messageStub).to.be.calledOnce.calledWith(accountCreationRequest);
  });

  it('should accept consistent entitlements via messaging', async () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = createDefaultUserData();
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      null,
      ProductType.SUBSCRIPTION,
      null
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.on = (ctor, cb) => {
      const messageType = new ctor();
      messageLabel = messageType.label();
      messageMap[messageLabel] = cb;
    };
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').resolves(port);
    const order = [];
    entitlementsManagerMock
      .expects('reset')
      .withExactArgs(
        sandbox.match((arg) => {
          if (order.indexOf('reset') == -1) {
            order.push('reset');
          }
          return arg === true; // Expected positive.
        })
      )
      .once();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(
        sandbox.match((arg) => {
          if (order.indexOf('pushNextEntitlements') == -1) {
            order.push('pushNextEntitlements');
          }
          return arg === 'ENTITLEMENTS_JWT';
        })
      )
      .once();
    entitlementsManagerMock.expects('setToastShown').withExactArgs(true).once();
    entitlementsManagerMock
      .expects('unblockNextNotification')
      .withExactArgs()
      .once();
    const params = getEventParams('');
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ACCOUNT_CREATED, true, params);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_ACCOUNT_ACKNOWLEDGED, true, params);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED, true, params);
    const messageStub = sandbox.stub(port, 'execute');

    await flow.start(response);
    await flow.readyPromise_;
    const entitlementsResponse = new EntitlementsResponse();
    entitlementsResponse.setJwt('ENTITLEMENTS_JWT');
    expect(messageLabel).to.equal(entitlementsResponse.label());
    const cb = messageMap[messageLabel];
    cb(entitlementsResponse);

    await flow.complete();
    const accountCreationRequest = new AccountCreationRequest();
    accountCreationRequest.setComplete(true);
    expect(messageStub).to.be.calledOnce.calledWith(accountCreationRequest);
    // Order must be strict: first reset, then pushNextEntitlements.
    expect(order).to.deep.equal(['reset', 'pushNextEntitlements']);
  });

  it('should restore a SKU for redirect', async () => {
    const purchaseData = new PurchaseData(
      '{"orderId":"ORDER", "productId":"SKU"}',
      'SIG'
    );

    const userData = createDefaultUserData();
    const entitlements = new Entitlements(SERVICE_NAME, TOKEN, [], null);
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      entitlements,
      ProductType.SUBSCRIPTION,
      null
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('SKU')
      )
      .once();
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('should tolerate unparseable purchase data', async () => {
    const purchaseData = new PurchaseData('unparseable', 'SIG');
    analyticsMock.expects('setSku').never();
    const userData = createDefaultUserData();
    const entitlements = new Entitlements(SERVICE_NAME, TOKEN, [], null);
    const response = new SubscribeResponse(
      RAW_ENTITLEMENTS,
      purchaseData,
      userData,
      entitlements,
      ProductType.SUBSCRIPTION,
      null
    );
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').resolves(port);
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('')
      )
      .once();
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('no iframe open if inline config id is empty', async () => {
    PayCompleteFlow.isInlineCta = true;
    PayCompleteFlow.inlineConfigId = '';
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_INLINE)
      );

    activitiesMock.expects('openIframe').never();
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
  });

  it('no iframe open if inline code snippet not found', async () => {
    const subscriptionConfigId = 'subscription_config_id';
    PayCompleteFlow.isInlineCta = true;
    PayCompleteFlow.inlineConfigId = subscriptionConfigId;
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_INLINE)
      );

    activitiesMock.expects('openIframe').never();
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('no iframe open if inline code snippet not match config id', async () => {
    PayCompleteFlow.isInlineCta = true;
    PayCompleteFlow.inlineConfigId = 'contribution_config_id';
    const subscriptionSnippet = createElement(win.document, 'div', {
      'rrm-inline-cta': 'subscription_config_id',
    });
    win.document.body.appendChild(subscriptionSnippet);
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_INLINE)
      );

    activitiesMock.expects('openIframe').never();
    await flow.start(response);
    await flow.readyPromise_;
  });

  it('child element removed when code snippet was found', async () => {
    const subscriptionConfigId = 'subscription_config_id';
    const subscriptionSnippet = createElement(win.document, 'div', {
      'rrm-inline-cta': subscriptionConfigId,
    });
    const childDiv = createElement(win.document, 'span', {
      'id': 'childElement',
    });
    subscriptionSnippet.appendChild(childDiv);
    win.document.body.appendChild(subscriptionSnippet);
    PayCompleteFlow.isInlineCta = true;
    PayCompleteFlow.inlineConfigId = subscriptionConfigId;
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_INLINE)
      );

    activitiesMock.expects('openIframe').resolves(port);
    expect(win.document.getElementById('childElement')).to.not.be.null;
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
    expect(win.document.getElementById('childElement')).to.be.null;
  });

  it('should have valid flow constructed for inline CTA', async () => {
    const subscriptionConfigId = 'subscription_config_id';
    const subscriptionSnippet = createElement(win.document, 'div', {
      'rrm-inline-cta': subscriptionConfigId,
    });
    win.document.body.appendChild(subscriptionSnippet);
    PayCompleteFlow.isInlineCta = true;
    PayCompleteFlow.inlineConfigId = subscriptionConfigId;
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_INLINE)
      );

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swg/ui/v1/payconfirmiframe?_=_&ctaMode=CTA_MODE_INLINE',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          idToken: USER_ID_TOKEN,
          productType: ProductType.SUBSCRIPTION,
          isSubscriptionUpdate: false,
          isOneTime: false,
          useUpdatedConfirmUi: false,
          skipAccountCreationScreen: false,
        }
      )
      .resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
    expect(subscriptionSnippet.firstChild.style.width).to.equal('100%');
  });

  it('should have valid flow for inline CTA with config id in quotation', async () => {
    const subscriptionConfigId = 'subscription_config_id';
    const subscriptionSnippet = createElement(win.document, 'div', {
      'rrm-inline-cta': '"' + subscriptionConfigId + '"',
    });
    win.document.body.appendChild(subscriptionSnippet);
    PayCompleteFlow.isInlineCta = true;
    PayCompleteFlow.inlineConfigId = subscriptionConfigId;
    const response = createDefaultSubscribeResponse();
    entitlementsManagerMock
      .expects('pushNextEntitlements')
      .withExactArgs(sandbox.match((arg) => arg === RAW_ENTITLEMENTS))
      .once();
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(
        AnalyticsEvent.IMPRESSION_ACCOUNT_CHANGED,
        true,
        getEventParams('', null, CtaMode.CTA_MODE_INLINE)
      );

    activitiesMock.expects('openIframe').resolves(port);
    await flow.start(response);
    await flow.readyPromise_;
    expect(PayCompleteFlow.waitingForPayClient).to.be.true;
  });

  describe('payments response', () => {
    let startStub;
    let triggerPromise;

    beforeEach(() => {
      PayCompleteFlow.isInlineCta = false;
      startStub = sandbox.stub(PayCompleteFlow.prototype, 'start');
      triggerPromise = undefined;
      callbacksMock
        .expects('triggerPaymentResponse')
        .withExactArgs(
          sandbox.match((arg) => {
            triggerPromise = arg;
            return true;
          })
        )
        .once();
    });

    it('should NOT start flow on a response failure', async () => {
      const error = new Error('intentional');
      analyticsMock.expects('setTransactionId').never();
      analyticsMock.expects('addLabels').never();
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.EVENT_PAYMENT_FAILED,
          false,
          getEventParams('')
        )
        .once();
      jserrorMock.expects('error').withExactArgs('Pay failed', error).once();

      await expect(responseCallback(Promise.reject(error))).to.be.rejectedWith(
        /intentional/
      );
      expect(startStub).to.not.be.called;
      expect(triggerPromise).to.exist;

      await expect(triggerPromise).to.be.rejectedWith(/intentional/);
    });

    it('should indicate contribution product type if error indicates it', async () => {
      const error = new Error('intentional');
      error.name = 'AbortError';
      error.productType = ProductType.UI_CONTRIBUTION;
      analyticsMock.expects('setTransactionId').never();
      analyticsMock.expects('addLabels').never();
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.ACTION_USER_CANCELED_PAYFLOW,
          true,
          getEventParams('')
        )
        .once();
      callbacksMock
        .expects('triggerFlowCanceled')
        .withExactArgs('contribute')
        .once();

      await responseCallback(Promise.reject(error));

      expect(startStub).to.not.be.called;

      await expect(triggerPromise).to.be.rejectedWith(/intentional/);
    });

    it('should start flow on a correct payment response', async () => {
      analyticsMock.expects('setTransactionId').never();
      callbacksMock.expects('triggerFlowCanceled').never();
      entitlementsManagerMock.expects('blockNextNotification').once();
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');

      await responseCallback(Promise.resolve(INTEGR_DATA_OBJ));
      expect(startStub).to.be.calledOnce;
      expect(startStub.args[0][0]).to.be.instanceof(SubscribeResponse);
      expect(triggerPromise).to.exist;

      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      expect(response.purchaseData.signature).to.equal('PD_SIG');
      expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
      expect(JSON.parse(response.raw)).to.deep.equal(
        JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']
      );
      expect(completeStub).to.not.be.called;
      response.complete();
      expect(completeStub).to.be.calledOnce;
    });

    describe('Transaction IDs', () => {
      it('should log cannot confirm TX ID for redirect case', async () => {
        analyticsMock
          .expects('setTransactionId')
          .withExactArgs('NEW_TRANSACTION_ID')
          .once();

        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.EVENT_GPAY_CANNOT_CONFIRM_TX_ID,
            true,
            undefined
          );
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);
        data['googleTransactionId'] = 'NEW_TRANSACTION_ID';

        await responseCallback(Promise.resolve(data));
        const response = await triggerPromise;
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      });

      it('should log confirm TX ID for non-redirect case', async () => {
        PayCompleteFlow.waitingForPayClient = true;
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(AnalyticsEvent.EVENT_CONFIRM_TX_ID, true, undefined);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);
        data['googleTransactionId'] = runtime.analytics().getTransactionId();

        await responseCallback(Promise.resolve(data));
        const response = await triggerPromise;
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      });

      it('should log a change in TX ID for non-redirect case', async () => {
        PayCompleteFlow.waitingForPayClient = true;
        const newTxId = 'NEW_TRANSACTION_ID';
        const eventParams = new EventParams();
        eventParams.setGpayTransactionId(newTxId);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(AnalyticsEvent.EVENT_CHANGED_TX_ID, true, eventParams);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);
        data['googleTransactionId'] = newTxId;

        await responseCallback(Promise.resolve(data));
        const response = await triggerPromise;
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      });

      it('log no TX ID from gPay and that logging has occured', async () => {
        PayCompleteFlow.waitingForPayClient = true;
        const eventParams = new EventParams();
        eventParams.setHadLogged(true);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(AnalyticsEvent.EVENT_GPAY_NO_TX_ID, true, eventParams);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);

        await responseCallback(Promise.resolve(data));
        const response = await triggerPromise;
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      });

      it('log no TX ID from gPay and that logging has not occured', async () => {
        const eventParams = new EventParams();
        eventParams.setHadLogged(false);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(AnalyticsEvent.EVENT_GPAY_NO_TX_ID, true, eventParams);
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        eventManagerMock
          .expects('logSwgEvent')
          .withExactArgs(
            AnalyticsEvent.EVENT_SUBSCRIPTION_PAYMENT_COMPLETE,
            true,
            getEventParams('', SubscriptionFlows.SUBSCRIBE)
          );
        const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);

        await responseCallback(Promise.resolve(data));
        const response = await triggerPromise;
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      });
    });

    it('should log EVENT_PAY_PAYMENT_COMPLETE with useUpdatedOfferFlows config', async () => {
      PayCompleteFlow.waitingForPayClient = true;
      clientConfigManagerMock
        .expects('getClientConfig')
        .returns(
          Promise.resolve(new ClientConfig({useUpdatedOfferFlows: true}))
        );

      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(AnalyticsEvent.EVENT_CONFIRM_TX_ID, true, undefined);
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.EVENT_PAY_PAYMENT_COMPLETE,
          true,
          getEventParams('')
        );
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
          true,
          getEventParams('', SubscriptionFlows.CONTRIBUTE)
        );
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE,
          true,
          getEventParams('', SubscriptionFlows.CONTRIBUTE)
        );

      const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);
      data['googleTransactionId'] = runtime.analytics().getTransactionId();
      data['paymentRequest'] = {
        'swg': {'oldSku': 'sku_to_replace'},
        'i': {'productType': ProductType.UI_CONTRIBUTION},
      };
      await responseCallback(Promise.resolve(data));
      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.productType).to.equal(ProductType.UI_CONTRIBUTION);
    });

    it('should log ACTION_PAYMENT_COMPLETE with contribution param', async () => {
      PayCompleteFlow.waitingForPayClient = true;
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(AnalyticsEvent.EVENT_CONFIRM_TX_ID, true, undefined);
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
          true,
          getEventParams('', SubscriptionFlows.CONTRIBUTE)
        );
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(
          AnalyticsEvent.EVENT_CONTRIBUTION_PAYMENT_COMPLETE,
          true,
          getEventParams('', SubscriptionFlows.CONTRIBUTE)
        );

      const data = Object.assign({}, INTEGR_DATA_OBJ_DECODED);
      data['googleTransactionId'] = runtime.analytics().getTransactionId();
      data['paymentRequest'] = {
        'swg': {'oldSku': 'sku_to_replace'},
        'i': {'productType': ProductType.UI_CONTRIBUTION},
      };
      await responseCallback(Promise.resolve(data));
      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.productType).to.equal(ProductType.UI_CONTRIBUTION);
    });

    it('should start flow on correct payment response w/o entitlements', async () => {
      // TODO(dvoytenko, #400): cleanup once entitlements is launched.
      callbacksMock.expects('triggerFlowCanceled').never();
      entitlementsManagerMock.expects('blockNextNotification').once();
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      const result = INTEGR_DATA_OBJ_NO_ENTITLEMENTS;

      await responseCallback(Promise.resolve(result));
      expect(startStub).to.be.calledOnce;
      expect(startStub.args[0][0]).to.be.instanceof(SubscribeResponse);
      expect(triggerPromise).to.exist;

      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      expect(response.purchaseData.signature).to.equal('PD_SIG');
      expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
      expect(JSON.parse(response.raw)).to.deep.equal(
        JSON.parse(atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']
      );
      expect(completeStub).to.not.be.called;
      response.complete();
      expect(completeStub).to.be.calledOnce;
    });

    it('should start flow on correct payment response as decoded obj', async () => {
      analyticsMock.expects('setTransactionId').never();
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      const result = INTEGR_DATA_OBJ_DECODED;

      await responseCallback(Promise.resolve(result));
      expect(startStub).to.be.calledOnce;
      expect(triggerPromise).to.exist;

      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      expect(response.purchaseData.signature).to.equal('PD_SIG');
      expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
      expect(JSON.parse(response.raw)).to.deep.equal(
        JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']
      );
      expect(completeStub).to.not.be.called;
      response.complete();
      expect(completeStub).to.be.calledOnce;
    });

    it('should start flow with data from request', async () => {
      analyticsMock.expects('setTransactionId').never();
      callbacksMock.expects('triggerFlowCanceled').never();
      entitlementsManagerMock.expects('blockNextNotification').once();
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');

      const data = Object.assign({}, INTEGR_DATA_OBJ);
      data['paymentRequest'] = {
        'swg': {'oldSku': 'sku_to_replace'},
        'i': {'productType': ProductType.UI_CONTRIBUTION},
      };

      await responseCallback(Promise.resolve(data));
      expect(startStub).to.be.calledOnce;
      expect(startStub.args[0][0]).to.be.instanceof(SubscribeResponse);
      expect(triggerPromise).to.exist;

      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.productType).to.equal(ProductType.UI_CONTRIBUTION);
      expect(response.oldSku).to.equal('sku_to_replace');
      expect(completeStub).to.not.be.called;
      response.complete();
      expect(completeStub).to.be.calledOnce;
    });

    it('should start flow on decoded response w/o entitlements', async () => {
      // TODO(dvoytenko, #400): cleanup once entitlements is launched.
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      const result = INTEGR_DATA_OBJ_DECODED_NO_ENTITLEMENTS;

      await responseCallback(Promise.resolve(result));
      expect(startStub).to.be.calledOnce;
      expect(triggerPromise).to.exist;

      const response = await triggerPromise;
      expect(response).to.be.instanceof(SubscribeResponse);
      expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
      expect(response.purchaseData.signature).to.equal('PD_SIG');
      expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
      expect(JSON.parse(response.raw)).to.deep.equal(
        JSON.parse(atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']
      );
      expect(completeStub).to.not.be.called;
      response.complete();
      expect(completeStub).to.be.calledOnce;
    });

    it('should NOT start flow on cancelation', async () => {
      analyticsMock.expects('setTransactionId').never();
      callbacksMock
        .expects('triggerFlowCanceled')
        .withExactArgs('subscribe')
        .once();
      const cancel = new DOMException('cancel', 'AbortError');
      responseCallback(Promise.reject(cancel));

      await tick(2);
      expect(startStub).to.not.be.called;
    });
  });
});

describes.realWin('parseSubscriptionResponse', (env) => {
  let pageConfig;
  let runtime;

  beforeEach(() => {
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(env.win, pageConfig);
  });

  it('should pass through the callback', () => {
    const complete = sandbox.spy();
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_STRING, complete);
    sr.complete();
    expect(complete).to.be.calledOnce;
  });

  it('should pass through the callback w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const complete = sandbox.spy();
    const sr = parseSubscriptionResponse(
      runtime,
      INTEGR_DATA_STRING_NO_ENTITLEMENTS,
      complete
    );
    sr.complete();
    expect(complete).to.be.calledOnce;
  });

  it('should parse a string response', () => {
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_STRING);
    expect(JSON.parse(sr.raw)).to.deep.equal(
      JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']
    );
    expect(sr.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements.raw).to.equal(ENTITLEMENTS_JWT);
  });

  it('should parse a string response w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const sr = parseSubscriptionResponse(
      runtime,
      INTEGR_DATA_STRING_NO_ENTITLEMENTS
    );
    expect(JSON.parse(sr.raw)).to.deep.equal(
      JSON.parse(atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']
    );
    expect(sr.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements).to.be.null;
  });

  it('should parse a json response', () => {
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_OBJ);
    expect(JSON.parse(sr.raw)).to.deep.equal(
      JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']
    );
    expect(sr.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements.raw).to.equal(ENTITLEMENTS_JWT);
    expect(sr.productType).to.equal(ProductType.SUBSCRIPTION);
    expect(sr.oldSku).to.be.null;
  });

  it('should parse a json response w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const sr = parseSubscriptionResponse(
      runtime,
      INTEGR_DATA_OBJ_NO_ENTITLEMENTS
    );
    expect(JSON.parse(sr.raw)).to.deep.equal(
      JSON.parse(atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']
    );
    expect(sr.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements).to.be.null;
  });

  it('should parse a decoded json response', () => {
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_OBJ_DECODED);
    expect(JSON.parse(sr.raw)).to.deep.equal(
      JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']
    );
    expect(sr.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements.raw).to.equal(ENTITLEMENTS_JWT);
  });

  it('should parse a decoded json response w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const sr = parseSubscriptionResponse(
      runtime,
      INTEGR_DATA_OBJ_DECODED_NO_ENTITLEMENTS
    );
    expect(JSON.parse(sr.raw)).to.deep.equal(
      JSON.parse(atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']
    );
    expect(sr.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements).to.be.null;
  });

  it('should parse productType and oldSku', () => {
    const data = Object.assign({}, INTEGR_DATA_OBJ);
    data['paymentRequest'] = {
      'swg': {'oldSku': 'sku_to_replace'},
      'i': {'productType': ProductType.UI_CONTRIBUTION},
    };
    const sr = parseSubscriptionResponse(runtime, data);
    expect(sr.productType).to.equal(ProductType.UI_CONTRIBUTION);
    expect(sr.oldSku).to.equal('sku_to_replace');
  });

  it('handles missing "swg" and "i" objects', () => {
    const data = Object.assign({}, INTEGR_DATA_OBJ);
    data['paymentRequest'] = {};
    const sr = parseSubscriptionResponse(runtime, data);
    expect(sr.productType).to.equal(ProductType.SUBSCRIPTION);
    expect(sr.oldSku).to.be.null;
  });

  it('parses productType when paymentRequest is not present', () => {
    const data = Object.assign({}, INTEGR_DATA_OBJ);
    data['productType'] = ProductType.UI_CONTRIBUTION;

    const response = parseSubscriptionResponse(runtime, data);

    expect(response.productType).to.equal(ProductType.UI_CONTRIBUTION);
  });

  it('should throw error', () => {
    expect(() => parseSubscriptionResponse(runtime, null)).to.throw(
      'unexpected payment response'
    );
  });

  it('should parse complete idToken', () => {
    const idToken =
      'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NS' +
      'IsImVtYWlsIjoidGVzdEBleGFtcGxlLm9yZyIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlL' +
      'CJuYW1lIjoiVGVzdCBPbmUiLCJwaWN0dXJlIjoiaHR0cHM6Ly9leGFtcGxlLm9yZy9h' +
      'dmF0YXIvdGVzdCIsImdpdmVuX25hbWUiOiJUZXN0IiwiZmFtaWx5X25hbWUiOiJPbmU' +
      'ifQ.SIG';
    const ud = parseUserData({idToken});
    expect(ud.idToken).to.equal(idToken);
    expect(ud.id).to.equal('12345');
    expect(ud.email).to.equal(USER_EMAIL);
    expect(ud.emailVerified).to.be.true;
    expect(ud.name).to.equal('Test One');
    expect(ud.givenName).to.equal('Test');
    expect(ud.familyName).to.equal('One');
    expect(ud.pictureUrl).to.equal('https://example.org/avatar/test');
  });

  it('should return null for bad token', () => {
    expect(parseUserData({})).to.be.null;
  });

  it('should parse absent entitlements', () => {
    expect(parseEntitlements(runtime, {})).to.be.null;
  });

  it('should parse complete entitlements', () => {
    const ent = parseEntitlements(runtime, {
      'signedEntitlements': ENTITLEMENTS_JWT,
    });
    expect(ent.raw).to.equal(ENTITLEMENTS_JWT);
    expect(ent.entitlements[0].source).to.equal('TEST');
  });
});
