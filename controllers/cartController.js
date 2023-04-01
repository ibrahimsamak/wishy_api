const boom = require("boom");
const util = require("util");
const async = require("async");
const _ = require("underscore");

const { Favorite } = require("../models/Favorite");
const { Cart } = require("../models/Cart");
const {
  Product,
  Category,
  Supplier,
  Product_Price,
  Place_Delivery,
} = require("../models/Product");
const { setting } = require("../models/Constant");
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
const { check_request_params } = require("../utils/utils");

exports.getCartReplacmentTotalsUserId = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    const tax = await setting.findOne({ code: "TAX" });

    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var deliverycost = 0.0;
    var expresscost = 0.0;

    var cart_arr = req.body.Cart;
    for await (const data of cart_arr) {
      var Product_Price_Object = await Product_Price.findOne({
        $and: [
          { place_id: place_id },
          { supplier_id: supplier_id },
          { product_id: data.product_id },
          { isDeleted: false },
        ],
      });

      if (Product_Price_Object) {
        if (
          Product_Price_Object.discountPriceReplacment &&
          Product_Price_Object.discountPriceReplacment != 0
        ) {
          totalPrice +=
            Number(Product_Price_Object.price_for_replacment) * data.qty;
          totalDiscount += Number(
            Product_Price_Object.discountPriceReplacment * data.qty
          );
        } else {
          totalPrice +=
            Number(Product_Price_Object.price_for_replacment) * data.qty;
        }

        deliverycost +=
          Number(Product_Price_Object.deliveryCost) * Number(data.qty);
        expresscost +=
          Number(Product_Price_Object.expressCost) * Number(data.qty);
      }
    }
    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);
  
    var returnObject = {
      tax:  Number(sub_total_delivery * Number(tax.value)),
      deliveryCost: Number(deliverycost),
      expressCost: Number(expresscost),
      total_price: Number(parseFloat(totalPrice).toFixed(2)),
      total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
      final_total: Number(parseFloat(final_total).toFixed(2)),
      final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
    };
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          returnObject
        )
      );
    return;
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getCartCount = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    var count = 0;
    var item = await Cart.find({ user_id: req.user._id })
      .limit(100)
      .sort({ _id: -1 })
      .lean();
    for await (const data of item) {
      if (data.product_id && data.product_id != "" && data.product_id != 0) {
        var _product = await Product.findOne({
          $and: [{ _id: data.product_id }, { isDeleted: false }],
        }).populate("category_id");
        if (_product) {
          var productObject = _product.toObject();

          var Product_Price_Object = await Product_Price.findOne({
            $and: [
              { place_id: place_id },
              { product_id: data.product_id },
              { supplier_id: supplier_id },
              { isDeleted: false },
            ],
          });
          if (Product_Price_Object) {
            count++;
          }
        }
      }
    }
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          count
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getCartTotalsUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    const tax = await setting.findOne({ code: "TAX" });

    var ar_msg = "";
    var en_msg = "";
    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var statusCode = 200;
    const item = await Cart.find({
      $and: [{ user_id: req.user._id }],
    })
      .limit(100)
      .sort({ _id: -1 })
      .lean();
    for await (const data of item) {
      var Product_Price_Object = await Product_Price.findOne({
        $and: [
          { place_id: place_id },
          { supplier_id: supplier_id },
          { product_id: data.product_id },
          { isDeleted: false },
        ],
      });

      if (Product_Price_Object) {
        // reply
        //   .code(200)
        //   .send(
        //     errorAPI(
        //       language,
        //       400,
        //       MESSAGE_STRING_ARABIC.ERROR,
        //       MESSAGE_STRING_ENGLISH.ERROR
        //     )
        //   );
        // return;

        if (
          Product_Price_Object.discountPrice &&
          Product_Price_Object.discountPrice != 0
        ) {
          totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
          totalDiscount += Number(
            Product_Price_Object.discountPrice * data.qty
          );
        } else {
          totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
        }

        deliverycost +=
          Number(Product_Price_Object.deliveryCost) * Number(data.qty);
        expresscost +=
          Number(Product_Price_Object.expressCost) * Number(data.qty);
        // totalPrice += data.Total;
        // totalDiscount += data.TotalDiscount;

        // var Product_Price_Object = await Product_Price.findOne({
        //   $and: [
        //     { product_id: data.product_id },
        //     { place_id: place_id },
        //     { supplier_id: supplier_id },
        //   ],
        // });

        if (data.supplier_id != supplier_id || data.place_id != place_id) {
          ar_msg = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
          en_msg = MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER;
          statusCode = 300;
        }
      }
    }

    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

    var returnObject = {
      tax:  Number(sub_total_delivery * Number(tax.value)),
      deliveryCost: Number(deliverycost),
      expressCost:Number(expresscost),
      total_price: Number(parseFloat(totalPrice).toFixed(2)),
      total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
      final_total: Number(parseFloat(final_total).toFixed(2)),
      final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
    };
    reply
      .code(200)
      .send(success(language, statusCode, ar_msg, en_msg, returnObject));
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getCartUserId = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    var ar_msg = "";
    var en_msg = "";
    var statusCode = 200;
    const tax = await setting.findOne({ code: "TAX" });

    var providerArr = [];
    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var productsCategoryMatualIds = []
    var productsIds = []
    var item = await Cart.find({ user_id: req.user._id })
      .limit(100)
      .sort({ _id: -1 })
      .lean();
    for await (const data of item) {
      var ProviderArrIndex = _.findIndex(providerArr, function (_item) {
        return String(_item._id) == String(data.supplier_id);
      });
      if (ProviderArrIndex >= 0) {
        //exsits
        if (data.product_id && data.product_id != "" && data.product_id != 0) {
          var product = await Product.findOne({
            $and: [{ _id: data.product_id }, { isDeleted: false }],
          }).populate("category_id");
          if (product) {
            productsIds.push(_product._id)
            productsCategoryMatualIds.push(_product.category_id._id)
            var productObject = product.toObject();

            var Product_Price_Object = await Product_Price.findOne({
              $and: [
                { place_id: place_id },
                { product_id: data.product_id },
                { supplier_id: supplier_id },
                { isDeleted: false },
              ],
            });

            if (Product_Price_Object) {
              const checkFavorite = await Favorite.findOne({
                $and: [
                  { user_id: req.user._id },
                  { product_id: data.product_id },
                ],
              });
              if (checkFavorite) {
                productObject.favorite_id = checkFavorite._id;
              } else {
                productObject.favorite_id = null;
              }

              var cateogory = {
                _id: productObject.category_id._id,
                name: productObject.category_id[`${language}Name`],
                image: productObject.category_id.image
                  ? productObject.category_id.image
                  : "",
              };
              productObject.category_id = cateogory;
              productObject.discountPrice = Product_Price_Object.discountPrice;
              productObject.discountPriceReplacement =
                Product_Price_Object.discountPriceReplacement;
              productObject.price_for_new = Product_Price_Object.price_for_new;
              productObject.price_for_replacment =
                Product_Price_Object.price_for_replacment;

              delete productObject.arName;
              delete productObject.enName;
              delete productObject.arDescription;
              delete productObject.enDescription;
              productObject.name = product[`${language}Name`];
              productObject.description = product[`${language}Description`];

              productObject.cart_id = data._id;
              productObject.qty = data.qty;
              productObject.Total = data.Total;
              productObject.TotalDiscount = data.TotalDiscount;

              providerArr[ProviderArrIndex].products.push(productObject);
            }
          }
        }
      } else {
        // new
        var provider_data = await Supplier.findOne({
          $and: [
            { _id: data.supplier_id },
            { isDeleted: false },
            { isBlock: false },
          ],
        }).select(["-token", "-password", "-cities"]);

        if (provider_data) {
          providerobject = provider_data.toObject();
          providerobject.products = [];

          if (
            data.product_id &&
            data.product_id != "" &&
            data.product_id != 0
          ) {
            var _product = await Product.findOne({
              $and: [{ _id: data.product_id }, { isDeleted: false }],
            }).populate("category_id");
            if (_product) {
              productsIds.push(_product._id)
              productsCategoryMatualIds.push(_product.category_id._id)
              var productObject = _product.toObject();
              var Product_Price_Object = await Product_Price.findOne({
                $and: [
                  { place_id: place_id },
                  { product_id: data.product_id },
                  { supplier_id: supplier_id },
                  { isDeleted: false },
                ],
              });
              if (Product_Price_Object) {
                const checkFavorite = await Favorite.findOne({
                  $and: [
                    { user_id: req.user._id },
                    { product_id: data.product_id },
                  ],
                });
                if (checkFavorite) {
                  productObject.favorite_id = checkFavorite._id;
                } else {
                  productObject.favorite_id = null;
                }

                var cateogory = {
                  _id: productObject.category_id._id,
                  name: productObject.category_id[`${language}Name`],
                  image: productObject.category_id.image
                    ? productObject.category_id.image
                    : "",
                };
                productObject.category_id = cateogory;
                productObject.discountPrice =
                  Product_Price_Object.discountPrice;
                productObject.discountPriceReplacement =
                  Product_Price_Object.discountPriceReplacement;
                productObject.price_for_new =
                  Product_Price_Object.price_for_new;
                productObject.price_for_replacment =
                  Product_Price_Object.price_for_replacment;

                delete productObject.arName;
                delete productObject.enName;
                delete productObject.arDescription;
                delete productObject.enDescription;
                productObject.name = _product[`${language}Name`];
                productObject.description = _product[`${language}Description`];
                productObject.cart_id = data._id;
                productObject.qty = data.qty;
                productObject.Total = data.Total;
                productObject.TotalDiscount = data.TotalDiscount;

                providerobject.products.push(productObject);
                providerArr.push(providerobject);
              }
            }
          }
        }
      }

      if (data.supplier_id != supplier_id || data.place_id != place_id) {
        ar_msg = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
        en_msg = MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER;
        statusCode = 300;
        // Cart.updateMany(
        //   { user_id: req.user._id },
        //   { supplier_id: supplier_id, place_id: place_id },
        //   function (err) {}
        // );
      }
      // totalPrice += data.Total;
      // totalDiscount += data.TotalDiscount;

      if (Product_Price_Object) {
        // reply
        //   .code(200)
        //   .send(
        //     errorAPI(
        //       language,
        //       400,
        //       MESSAGE_STRING_ARABIC.ERROR,
        //       MESSAGE_STRING_ENGLISH.ERROR
        //     )
        //   );
        // return;

        if (
          Product_Price_Object.discountPrice &&
          Product_Price_Object.discountPrice != 0
        ) {
          totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
          totalDiscount += Number(
            Product_Price_Object.discountPrice * data.qty
          );
        } else {
          totalPrice += Number(Product_Price_Object.price_for_new) * data.qty;
        }

        deliverycost +=
          Number(Product_Price_Object.deliveryCost) * Number(data.qty);

        expresscost +=  Number(Product_Price_Object.expressCost) * Number(data.qty);
      }

    }

    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

    var Product_Prices = await Product_Price.find({
      $and: [
        { place_id: place_id },
        { supplier_id: supplier_id },
        { isDeleted: false },
      ],
    });
   
    var matualProducts = await Product.find({ $and:[{ category_id:{ $in: productsCategoryMatualIds } }, { _id:{ $nin:productsIds } }, {_id:{$in:Product_Prices.map(x=>x.product_id)}}, {isNewProduct:true} , {isDeleted:false}, {isReplacement:false}] }).populate("category_id").limit(40)
    var returnArr = []
    for await (const data of matualProducts) {
      var Product_Price_Object = Product_Prices.find((x) => {
        return String(x.product_id) === String(data._id);
      });

      const newObj = data.toObject();
      newObj.favorite_id = null;
      var cateogory = {
        _id: data.category_id._id,
        name: data.category_id[`${language}Name`],
        image: data.category_id.image ? data.category_id.image : "",
      };

      delete newObj.arName;
      delete newObj.enName;
      delete newObj.arDescription;
      delete newObj.enDescription;
      newObj.discountPrice = Product_Price_Object.discountPrice;
      newObj.price_for_new = Product_Price_Object.price_for_new;
      newObj.price_for_replacment = Product_Price_Object.price_for_replacment;
      newObj.name = data[`${language}Name`];
      newObj.description = data[`${language}Description`];
      newObj.category_id = cateogory;
      returnArr.push(newObj);
    }
    var returnObject = { 
      matualProducts: returnArr,
      results: providerArr,
      tax:  Number(sub_total_delivery * Number(tax.value)),
      deliveryCost: Number(deliverycost),
      expressCost: Number(expresscost),
      total_price: Number(parseFloat(totalPrice).toFixed(2)),
      total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
      final_total: Number(parseFloat(final_total).toFixed(2)),
      final_express_total: Number(parseFloat(final_express_total).toFixed(2))
    };

    reply.code(200).send(success(language, statusCode, ar_msg, en_msg, returnObject));
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addProduct = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var validationArray = [{ name: "product_id" }, { name: "qty" }];

    check_request_params(req.body, validationArray, async function (response) {
      if (response.success) {
        var place_id = req.headers["place"];
        var supplier_id = req.headers["supplier"];
        var total = 0.0;
        var totalDiscount = 0.0;
        const provider = await Product.findOne({
          $and: [{ _id: req.body.product_id }, { isDeleted: false }],
        });
        console.log(provider);
        if (!provider) {
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

        var Product_Price_Object = await Product_Price.findOne({
          $and: [
            { place_id: place_id },
            { supplier_id: supplier_id },
            { product_id: provider._id },
            { isDeleted: false },
          ],
        });

        if (!Product_Price_Object) {
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

        if (
          Product_Price_Object.discountPrice &&
          Product_Price_Object.discountPrice != 0
        ) {
          total = Number(Product_Price_Object.price_for_new) * req.body.qty;
          totalDiscount = Number(
            Product_Price_Object.discountPrice * req.body.qty
          );
        } else {
          total = Number(Product_Price_Object.price_for_new) * req.body.qty;
        }

        const checkBefore = await Cart.findOne({
          $and: [
            { user_id: req.user._id },
            { supplier_id: supplier_id },
            { product_id: req.body.product_id },
            { place_id: place_id },
          ],
        });
        if (checkBefore) {
          if (
            Product_Price_Object.discountPrice &&
            Product_Price_Object.discountPrice != 0
          ) {
            total =
              Number(Product_Price_Object.price_for_new) *
              Number(checkBefore.qty + 1);

            totalDiscount = Number(
              Product_Price_Object.discountPrice * Number(checkBefore.qty + 1)
            );
          } else {
            total =
              Number(Product_Price_Object.price_for_new) *
              Number(checkBefore.qty + 1);
          }
          const Carts = await Cart.findByIdAndUpdate(
            checkBefore._id,
            {
              $inc: { qty: 1 },
              Total: total,
              TotalDiscount: totalDiscount,
            },
            { new: true }
          );
          reply
            .code(200)
            .send(
              success(
                language,
                200,
                MESSAGE_STRING_ARABIC.SUCCESS,
                MESSAGE_STRING_ENGLISH.SUCCESS,
                Carts
              )
            );
          return;
        } else {
          // add new
          let _Cart = new Cart({
            user_id: req.user._id,
            product_id: req.body.product_id,
            supplier_id: supplier_id,
            place_id: place_id,
            qty: req.body.qty,
            Total: total,
            TotalDiscount: totalDiscount,
            isProduct: true,
            createAt: getCurrentDateTime(),
          });

          let rs = await _Cart.save();
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
      } else {
        reply.send(response);
      }
    });
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.UpdateCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var validationArray = [{ name: "Cart" }];

    check_request_params(req.body, validationArray, async function (response) {
      if (response.success) {
        var place_id = req.headers["place"];
        var supplier_id = req.headers["supplier"];
        var total = 0.0;
        var totalDiscount = 0.0;
        //update qty
        var requestedCart = [];
        requestedCart = req.body.Cart;
        var cart_id = [];
        for await (const data of requestedCart) {
          // cart_id.push(data.cart_id);
          const item = await Cart.findById(data.cart_id);
          if (!item) {
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
          var Product_Price_Object = await Product_Price.findOne({
            $and: [
              { place_id: place_id },
              { supplier_id: supplier_id },
              { product_id: item.product_id },
              { isDeleted: false },
            ],
          });

          if (!Product_Price_Object) {
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

          if (
            Product_Price_Object.discountPrice &&
            Product_Price_Object.discountPrice != 0
          ) {
            total = Number(Product_Price_Object.price_for_new) * data.qty;
            totalDiscount = Number(
              Product_Price_Object.discountPrice * data.qty
            );
          } else {
            total = Number(Product_Price_Object.price_for_new) * data.qty;
          }

          await Cart.findByIdAndUpdate(
            data.cart_id,
            {
              qty: data.qty,
              Total: total,
              TotalDiscount: totalDiscount,
            },
            { new: true }
          );
        }
        reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS
            )
          );
        return;
      } else {
        reply.send(response);
      }
    });
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.deleteCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    Cart.deleteMany(
      {
        $and: [{ user_id: req.user._id }],
      },
      function (err) {
        console.log("deleted >> ");
      }
    );

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.deleteItemCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var Carts = await Cart.findByIdAndRemove(req.query.cart_id);
    if (!Carts) {
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
    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          Carts
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
