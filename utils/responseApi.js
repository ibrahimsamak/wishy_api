const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");

/**
 * @desc    Send any success response
 *
 * @param   {string} status
 * @param   {string} message
 * @param   {string} messageAr
 * @param   {string} messageEn
 * @param   {object | array} items
 * @param   {number} statusCode
 * @param   {object} pagination
 */
exports.success = (
  langauage,
  code = 200,
  messageAr,
  messageEn,
  items,
  pagination
) => {
  var message = getMessageOnLanguage(messageAr, messageEn, langauage);
  return {
    status: true,
    code: code,
    message,
    items,
    pagination,
  };
};

/**
 * @desc    Send any error response
 *
 * @param   {string} message
 * @param   {object | array} results
 * @param   {number} statusCode
 * @param   {object | array} items
 */
exports.errorAPI = (
  langauage,
  statusCode,
  messageAr,
  messageEn,
  items = {}
) => {
  // List of common HTTP request code
  const err = new Error();
  const codes = [
    200,
    201,
    400,
    401,
    402,
    404,
    405,
    403,
    422,
    410,
    420,
    430,
    500,
  ];

  // Get matched code
  const findCode = codes.find((code) => code == statusCode);

  if (!findCode) statusCode = 500;
  else statusCode = findCode;
  err.code = statusCode;

  var _message = getMessageOnLanguage(messageAr, messageEn, langauage);
  return {
    status: false,
    code: err.code,
    message: _message,
    items: items,
  };
};

/**
 * @desc    Send any validation response
 * @param   {object | array} errors
 */

function getMessageOnLanguage(msgAr, msgEn, language) {
  console.log(msgAr, msgEn, language);
  if (language == LANGUAGE_ENUM.EN) {
    return msgEn;
  } else {
    return msgAr;
  }
}
