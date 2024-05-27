const boom = require("boom");
const util = require("util");
const async = require("async");

const { Favorite } = require("../models/Favorite");
const { Product_Price, Product } = require("../models/Product");
const { getCurrentDateTime } = require("../models/Constant");
const { success, errorAPI } = require("../utils/responseApi");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");

exports.getFavoriteByUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const place_id = req.headers["place"];
    const supplier_id = req.headers["supplier"];
    var ar_msg = MESSAGE_STRING_ARABIC.SUCCESS;
    var en_msg = MESSAGE_STRING_ENGLISH.SUCCESS;

    var returnArr = [];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var check;
    var statusCode = 200;
    const total = await Favorite.find({
      $and: [
        { user_id: req.user._id },
      ],
    }).countDocuments();

    var items = await Favorite.find({
      $and: [
        { user_id: req.user._id },
      ],
      })
      .populate({ path: "product_id", populate: { path: "by" } })

      .skip(page * limit)
      .limit(limit)
      .sort({ _id: -1 });

    for await (const data of items) {
        const newObj = data.toObject();
        const checkFavorite = await Favorite.findOne({
          $and: [
            { user_id: req.user._id },
            { product_id: data.product_id._id },
            { supplier_id: supplier_id },
          ],
        });
        if (checkFavorite) {
          newObj.product_id.favorite_id = checkFavorite._id;
        } else {
          newObj.product_id.favorite_id = null;
        }

        delete newObj.product_id.arName;
        delete newObj.product_id.enName;
        delete newObj.product_id.arDescription;
        delete newObj.product_id.enDescription;
        newObj.product_id.name = data.product_id[`${language}Name`];
        newObj.product_id.description = data.product_id[`${language}Description`];
        returnArr.push(newObj);
      }

      reply.code(200).send(
        success(language, statusCode, ar_msg, en_msg, returnArr, {
          size: returnArr.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        })
      );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addDeleteFavorite = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    if (!req.body.product_id) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR,
            MESSAGE_STRING_ENGLISH.ERROR
          )
        );
      return;
    }
    const checkBefore = await Favorite.findOne({
      $and: [{ user_id: req.user._id }, { product_id: req.body.product_id }],
    });
    if (checkBefore) {
      const Favorites = await Favorite.findOneAndRemove({
        $and: [{ product_id: req.body.product_id }, { user_id: req.user._id }],
      });
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.DELETED,
            MESSAGE_STRING_ENGLISH.DELETED,
            Favorites
          )
        );
      return;
    } else {
      let fav = new Favorite({
        user_id: req.user._id,
        product_id: req.body.product_id,
        createAt: getCurrentDateTime(),
      });

      let rs = await fav.save();
      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.SUCCESS,
            MESSAGE_STRING_ENGLISH.SUCCESS,
            rs
          )
        );
      return;
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
