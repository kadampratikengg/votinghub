import axios from 'axios';

const RAZORPAY_SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const CASHFREE_SDK_URL = 'https://sdk.cashfree.com/js/v3/cashfree.js';
const PAYMENT_CONTEXT_PREFIX = {
  razorpay: 'razorpay-payment-context:',
  cashfree: 'cashfree-payment-context:',
};
const PAYMENT_RESPONSE_PREFIX = {
  razorpay: 'razorpay-payment-response:',
  cashfree: 'cashfree-payment-response:',
};
const PENDING_PAYMENT_KEY = 'payment-pending-session';

const getApiUrl = () =>
  (process.env.REACT_APP_API_URL || '')
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean) || '';

const getRazorpayKey = () => process.env.REACT_APP_RAZORPAY_KEY || '';

const getContextKey = (provider, orderId) =>
  `${PAYMENT_CONTEXT_PREFIX[provider] || PAYMENT_CONTEXT_PREFIX.razorpay}${orderId}`;

const getResponseKey = (provider, orderId) =>
  `${PAYMENT_RESPONSE_PREFIX[provider] || PAYMENT_RESPONSE_PREFIX.razorpay}${orderId}`;

const getSessionProvider = (provider) =>
  String(provider || 'razorpay').trim().toLowerCase() === 'cashfree'
    ? 'cashfree'
    : 'razorpay';

const setPaymentContext = (provider, orderId, context) => {
  const normalizedProvider = getSessionProvider(provider);
  sessionStorage.setItem(
    getContextKey(normalizedProvider, orderId),
    JSON.stringify({ ...context, paymentProvider: normalizedProvider }),
  );
};

const getPaymentContext = (provider, orderId) => {
  const normalizedProvider = getSessionProvider(provider);
  try {
    const raw = sessionStorage.getItem(getContextKey(normalizedProvider, orderId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to read payment context', error.message);
    return null;
  }
};

const clearPaymentContext = (provider, orderId) => {
  const normalizedProvider = getSessionProvider(provider);
  sessionStorage.removeItem(getContextKey(normalizedProvider, orderId));
};

const savePaymentResponse = (provider, orderId, response) => {
  const normalizedProvider = getSessionProvider(provider);
  sessionStorage.setItem(
    getResponseKey(normalizedProvider, orderId),
    JSON.stringify(response),
  );
};

const getPaymentResponse = (provider, orderId) => {
  const normalizedProvider = getSessionProvider(provider);
  try {
    const raw = sessionStorage.getItem(getResponseKey(normalizedProvider, orderId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to read payment response', error.message);
    return null;
  }
};

const clearPaymentResponse = (provider, orderId) => {
  const normalizedProvider = getSessionProvider(provider);
  sessionStorage.removeItem(getResponseKey(normalizedProvider, orderId));
};

const setPendingPaymentSession = (session) => {
  const normalizedProvider = getSessionProvider(session?.provider);
  const payload = {
    provider: normalizedProvider,
    orderId: session?.orderId || '',
  };
  sessionStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payload));
  if (payload.orderId) {
    sessionStorage.setItem('razorpay-pending-order-id', payload.orderId);
  }
};

export const getPendingPaymentSession = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        provider: getSessionProvider(parsed?.provider),
        orderId: parsed?.orderId || '',
      };
    }
  } catch (error) {
    console.warn('Failed to read pending payment session', error.message);
  }

  const legacyOrderId = sessionStorage.getItem('razorpay-pending-order-id') || '';
  return legacyOrderId
    ? { provider: 'razorpay', orderId: legacyOrderId }
    : { provider: '', orderId: '' };
};

export const getPendingOrderId = () => getPendingPaymentSession().orderId || '';

export const getPendingPaymentProvider = () =>
  getPendingPaymentSession().provider || '';

const clearPendingPaymentSession = () => {
  sessionStorage.removeItem(PENDING_PAYMENT_KEY);
  sessionStorage.removeItem('razorpay-pending-order-id');
};

const loadRazorpaySdk = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SDK_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Razorpay));
      existingScript.addEventListener('error', () =>
        reject(new Error('Failed to load Razorpay checkout script')),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () =>
      reject(new Error('Failed to load Razorpay checkout script'));
    document.body.appendChild(script);
  });

const loadCashfreeSdk = () =>
  new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${CASHFREE_SDK_URL}"]`,
    );
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.Cashfree));
      existingScript.addEventListener('error', () =>
        reject(new Error('Failed to load Cashfree checkout script')),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = CASHFREE_SDK_URL;
    script.async = true;
    script.onload = () => resolve(window.Cashfree);
    script.onerror = () =>
      reject(new Error('Failed to load Cashfree checkout script'));
    document.body.appendChild(script);
  });

const fetchProfile = async (token) => {
  const apiUrl = getApiUrl();
  if (!apiUrl || !token) return;

  try {
    await axios.get(`${apiUrl}/api/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    console.error(
      'Error fetching profile after verify:',
      error?.response || error.message,
    );
  }
};

const buildOrderPayload = (plan, email, userId, additionalData = {}) => ({
  amount: Math.round(plan.total * 100),
  currency: 'INR',
  email: email || additionalData.email,
  userId: userId || localStorage.getItem('userId'),
  planDuration: plan.duration,
  validityDays: plan.validityDays,
  votingCredits: plan.votingCredits,
  mrp: plan.mrp,
  discount: plan.discount,
  gst: plan.gst,
});

const buildPaymentContext = (plan, email, userId, additionalData = {}, provider) => ({
  email: email || additionalData.email || '',
  userId: userId || localStorage.getItem('userId') || '',
  planDuration: plan.duration,
  amount: Math.round(plan.total * 100),
  validityDays: plan.validityDays,
  votingCredits: plan.votingCredits,
  mrp: plan.mrp,
  discount: plan.discount,
  gst: plan.gst,
  additionalData,
  paymentProvider: provider,
});

const finalizePayment = async (
  provider,
  orderId,
  setErrorMessage,
  setLoading,
  navigate,
  callback,
  paymentResponse = null,
) => {
  const normalizedProvider = getSessionProvider(provider);
  const context = getPaymentContext(normalizedProvider, orderId);

  if (!context) {
    setErrorMessage(
      'Payment session expired or missing. Please start the purchase again.',
    );
    setLoading(false);
    return;
  }

  const resolvedResponse =
    paymentResponse || getPaymentResponse(normalizedProvider, orderId) || {};
  const verifyPayload = {
    paymentProvider: normalizedProvider,
    order_id: orderId,
    userId: context.userId || localStorage.getItem('userId'),
    email: context.email,
    planDuration: context.planDuration,
    amount: context.amount,
    validityDays: context.validityDays,
    votingCredits: context.votingCredits,
    mrp: context.mrp,
    discount: context.discount,
    gst: context.gst,
    ...context.additionalData,
  };

  if (normalizedProvider === 'cashfree') {
    verifyPayload.cashfree_order_id = resolvedResponse.order_id || orderId;
    verifyPayload.cashfree_payment_id =
      resolvedResponse.payment_id ||
      resolvedResponse.cf_payment_id ||
      resolvedResponse.transaction_id ||
      '';
    verifyPayload.cashfree_payment_status =
      resolvedResponse.payment_status ||
      resolvedResponse.order_status ||
      resolvedResponse.status ||
      '';
    verifyPayload.cashfree_signature =
      resolvedResponse.signature || resolvedResponse.cf_signature || '';
  } else {
    verifyPayload.razorpay_order_id = resolvedResponse?.razorpay_order_id || orderId;
    verifyPayload.razorpay_payment_id =
      resolvedResponse?.razorpay_payment_id || '';
    verifyPayload.razorpay_signature =
      resolvedResponse?.razorpay_signature || '';
  }

  try {
    setLoading(true);
    const verifyResponse = await axios.post(
      `${getApiUrl()}/verify-payment`,
      verifyPayload,
      { withCredentials: true },
    );

    if (
      verifyResponse?.status === 202 ||
      verifyResponse?.data?.paymentStatus === 'pending' ||
      verifyResponse?.data?.message === 'Payment is not completed yet'
    ) {
      const pendingMessage =
        verifyResponse?.data?.message || 'Payment is still processing';

      if (typeof callback === 'function') {
        callback({
          paymentStatus: 'pending',
          paymentMessage: pendingMessage,
          orderStatus: verifyResponse?.data?.orderStatus || 'PENDING',
        });
      }

      setErrorMessage(pendingMessage);
      setLoading(false);
      return;
    }

    if (
      verifyResponse?.data?.message !==
        'Payment verified and subscription updated' &&
      verifyResponse?.data?.message !==
        'Payment already verified and subscription updated'
    ) {
      throw new Error(
        verifyResponse?.data?.message || 'Payment verification did not complete',
      );
    }

    localStorage.setItem('token', verifyResponse.data.token);
    localStorage.setItem('userId', verifyResponse.data.userId);
    localStorage.setItem('role', 'admin');
    localStorage.setItem('subUserRole', '');
    localStorage.setItem('permissions', JSON.stringify(['*']));
    localStorage.setItem('isAuthenticated', 'true');

    clearPaymentContext(normalizedProvider, orderId);
    clearPaymentResponse(normalizedProvider, orderId);
    clearPendingPaymentSession();

    const successMessage =
      'Payment successful. Voting credits added to your account.';

    await fetchProfile(verifyResponse.data.token || localStorage.getItem('token'));

    if (navigate) {
      navigate('/profile', {
        replace: true,
        state: {
          paymentStatus: 'success',
          paymentMessage: successMessage,
        },
      });
    }

    if (typeof callback === 'function') {
      callback({
        paymentStatus: 'success',
        paymentMessage: successMessage,
      });
    }

    setLoading(false);
  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error);
    const responseData = error.response?.data || {};
    const paymentMessage =
      responseData.raw?.description ||
      responseData.raw?.message ||
      responseData.message ||
      error.message ||
      'Payment verification failed';

    if (typeof callback === 'function') {
      callback({
        paymentStatus: 'failed',
        paymentMessage,
        orderStatus: responseData.orderStatus || '',
      });
    }

    setErrorMessage(paymentMessage);
    setLoading(false);
  }
};

export const finalizeRazorpayPayment = (
  orderId,
  setErrorMessage,
  setLoading,
  navigate,
  callback,
  paymentResponse = null,
) =>
  finalizePayment(
    'razorpay',
    orderId,
    setErrorMessage,
    setLoading,
    navigate,
    callback,
    paymentResponse,
  );

export const finalizeCashfreePayment = (
  orderId,
  setErrorMessage,
  setLoading,
  navigate,
  callback,
  paymentResponse = null,
) =>
  finalizePayment(
    'cashfree',
    orderId,
    setErrorMessage,
    setLoading,
    navigate,
    callback,
    paymentResponse,
  );

export const initiatePayment = async (
  plan,
  email,
  userId,
  setErrorMessage,
  setLoading,
  navigate,
  callback,
  additionalData = {},
  paymentGateway = 'razorpay',
) => {
  if (
    !plan.total ||
    !plan.duration ||
    !plan.validityDays ||
    !plan.votingCredits
  ) {
    console.error('Invalid plan details:', plan);
    setErrorMessage('Invalid plan details');
    setLoading(false);
    return;
  }

  if (!email && !userId && !additionalData.email) {
    console.error('Missing user information:', {
      email,
      userId,
      additionalData,
    });
    setErrorMessage(
      'User information missing. Please log in or provide required details.',
    );
    setLoading(false);
    navigate('/');
    return;
  }

  const normalizedGateway = getSessionProvider(paymentGateway);
  if (normalizedGateway === 'razorpay' && !getRazorpayKey()) {
    setErrorMessage('Payment configuration error: Razorpay key is not set');
    setLoading(false);
    return;
  }

  setLoading(true);

  try {
    const orderPayload = buildOrderPayload(plan, email, userId, additionalData);
    const paymentContext = buildPaymentContext(
      plan,
      email,
      userId,
      additionalData,
      normalizedGateway,
    );

    if (normalizedGateway === 'cashfree') {
      const response = await axios.post(
        `${getApiUrl()}/create-cashfree-order`,
        {
          ...orderPayload,
          paymentProvider: 'cashfree',
        },
        { withCredentials: true },
      );

      const responseData = response.data || {};
      const orderId =
        responseData.order_id ||
        responseData.orderId ||
        responseData.id ||
        responseData.data?.order_id;
      const paymentSessionId =
        responseData.payment_session_id ||
        responseData.paymentSessionId ||
        responseData.data?.payment_session_id;

      if (!orderId) {
        throw new Error(
          responseData.details ||
            responseData.message ||
            'Cashfree order id was not returned',
        );
      }

      if (!paymentSessionId) {
        throw new Error(
          responseData.details ||
            responseData.message ||
            'Cashfree payment session was not returned',
        );
      }

      setPaymentContext(normalizedGateway, orderId, paymentContext);
      setPendingPaymentSession({ provider: normalizedGateway, orderId });

      const CashfreeCheckout = await loadCashfreeSdk();
      if (!CashfreeCheckout) {
        throw new Error('Cashfree checkout is not available');
      }

      const cashfreeMode =
        responseData.environment ||
        (process.env.REACT_APP_CASHFREE_ENV || '').toLowerCase() ||
        'sandbox';
      const cashfree = CashfreeCheckout({ mode: cashfreeMode });
      const checkoutResult = cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_self',
      });

      if (checkoutResult && typeof checkoutResult.then === 'function') {
        checkoutResult.catch((checkoutError) => {
          console.error('Cashfree checkout error:', checkoutError);
        });
      }

      setLoading(false);
      return;
    }

    const response = await axios.post(`${getApiUrl()}/create-order`, orderPayload, {
      withCredentials: true,
    });

    const responseData = response.data || {};
    const order_id =
      responseData.order_id ||
      responseData.orderId ||
      responseData.id ||
      responseData.data?.order_id;

    if (!order_id) {
      throw new Error(
        responseData.details ||
          responseData.message ||
          'Razorpay order id was not returned',
      );
    }

    setPaymentContext(normalizedGateway, order_id, paymentContext);
    setPendingPaymentSession({ provider: normalizedGateway, orderId: order_id });

    const RazorpayCheckout = await loadRazorpaySdk();
    if (!RazorpayCheckout) {
      throw new Error('Razorpay checkout is not available');
    }

    const options = {
      key: responseData.key_id || getRazorpayKey(),
      amount: responseData.amount || Math.round(plan.total * 100),
      currency: responseData.currency || 'INR',
      name: 'VotingHub',
      description: `Voting credits: ${plan.duration}`,
      order_id,
      prefill: {
        email: email || additionalData.email || '',
        contact: additionalData.phone || '',
      },
      theme: { color: '#1f7a4d' },
      handler: async (responsePayload) => {
        savePaymentResponse(normalizedGateway, order_id, responsePayload);
        await finalizeRazorpayPayment(
          order_id,
          setErrorMessage,
          setLoading,
          navigate,
          callback,
          responsePayload,
        );
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        },
      },
    };

    const razorpayInstance = new RazorpayCheckout(options);
    razorpayInstance.on('payment.failed', (responsePayload) => {
      console.error('Payment failed:', responsePayload.error);
      setErrorMessage(
        `Payment failed: ${responsePayload.error?.description || 'Unknown error'}`,
      );
      setLoading(false);
    });
    razorpayInstance.open();
    setLoading(false);
  } catch (error) {
    console.error(
      'Order creation error:',
      error.response?.data || error.message,
    );
    const responseData = error.response?.data || {};
    const orderErrorMessage =
      responseData.raw?.description ||
      responseData.raw?.message ||
      responseData.details ||
      responseData.message ||
      `Failed to initiate payment: ${error.message}`;
    setErrorMessage(orderErrorMessage);
    setLoading(false);
  }
};
