// External Dependancies
const boom = require("boom");
const moment = require("moment");
const cron = require("node-cron");
const async = require("async");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const _ = require("underscore");

// Get Data Models
const { coupon, coupon_usage } = require("../models/Coupon");
const { Order } = require("../models/Order");
const { Cart } = require("../models/Cart");
const { package, setting, place } = require("../models/Constant");
const { Users, User_Address } = require("../models/User");
const { Notifications } = require("../models/Notifications");
const { getCurrentDateTime, currentDate } = require("../models/Constant");
const { CONTROLLER_ENUM } = require("../utils/constants");
const { success, errorAPI } = require("../utils/responseApi");
const {
  Product,
  Category,
  Supplier,
  Product_Price,
  Place_Delivery,
  SubCategory,
} = require("../models/Product");

const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
} = require("../utils/constants");
const {
  CreateNotificationMultiple,
  CreateGeneralNotification,
  handleError,
  check_coupon,
} = require("../utils/utils");

// cron job for renting racks
exports.FinishActiveCoupon = async function FinishingHotelReservation() {
  // */1 * * * *
  // 0 0 0 * * *
  cron.schedule(`0 0 * * *`, async () => {
    const coupons = await coupon.find({
      isActive: true,
    });

    async.eachSeries(
      coupons,
      async function updateObject(element, done) {
        var a = moment(element.dt_to);
        var today = moment().tz("Asia/Riyadh");
        var b = moment(element.dt_from);
        var days = today.diff(a, "days");
        if (days >= 0) {
          await coupon.findByIdAndUpdate(
            element._id,
            {
              isActive: false,
            },
            {
              new: true,
            }
          );
        }
      },
      async function allDone(err) {
        //send notification to client to rate
        console.log("running a task every minute");
      }
    );
  });
};

// Get all coupon
exports.getmycoupon = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};
    query["by_id"] = { $eq: req.body.by_id };

    const total = await coupon.find(query).countDocuments();
    const item = await coupon
      .find(query)
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getcoupon = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    const total = await coupon.find(query).countDocuments();
    const item = await coupon
      .find(query)
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.couponusage = async (req, reply) => {
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    const total = await Order.find({
      $and: [{ couponCode: req.body.couponCode }, { StatusId: 4 }],
    }).countDocuments();
    const item = await Order.find({
      $and: [{ couponCode: req.body.couponCode }, { StatusId: 4 }],
    })
      .populate("user_id")
      .populate("provider_id")
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// Get single coupon by ID
exports.getSinglecoupon = async (req, reply) => {
  try {
    const sp = await coupon.findById(req.params.id);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: sp,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

// Add a new coupon
exports.addcoupon = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const prevCoupon = await coupon.findOne({ coupon: req.body.coupon });
    if (prevCoupon) {
      const response = {
        status_code: 400,
        status: false,
        message: "عذرا .. الكوبون مضاف مسبقا",
        items: null,
      };
      reply.send(response);
      return;
    }

    var arr = [];
    var a = moment(req.body.dt_to);
    var b = moment(req.body.dt_from);
    var days = a.diff(b, "days");

    let _coupon = new coupon({
      coupon: req.body.coupon,
      dt_from: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
      dt_to: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
      days: days,
      discount_rate: req.body.discount_rate,
      isActive: true,
      description: req.body.description
    });
    var _return = handleError(_coupon.validateSync());
    if (_return.length > 0) {
      reply.code(200).send({
        status_code: 400,
        status: false,
        message: _return[0],
        items: _return,
      });
      return;
    }
    let rs = await _coupon.save();

    const object2 = await Users.find({
      $and: [{ isBlock: false }, { fcmToken: { $ne: "" } }],
    });
    // object2.forEach((x) => {
    //   arr.push(x.fcmToken);
    // });


    let msg = `استخدم كوبون ${req.body.coupon} واحصل على خصم ${Number(
      req.body.discount_rate * 100
    )}% من قيمة التوصيل`;

    var docs = [];

    if (arr.length > 0) {
      for await (const doc of arr) {
        let _Notification2 = new Notifications({
          fromId: supplier._id,
          user_id: doc._id,
          title: "عروضات وتخفيضات",
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: 2,
          body_parms: rs.coupon,
          isRead: false,
          fromName: "الادارة",
          toName: doc.name,
        });
        docs.push(_Notification2);
        // _Notification2.save();
      }

      await Notifications.insertMany(docs, (err, _docs) => {
        if (err) {
          return console.error(err);
        } else {
          console.log("Multiple documents inserted to Collection");
        }
      });
      var fcmTokenArray = arr.map((x) => x.fcmToken);
      CreateNotificationMultiple(
        fcmTokenArray,
        "عروضات وتخفيضات",
        msg,
        rs.coupon
      );
    }

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
  } catch (err) {
    throw boom.boomify(err);
  }
};

// delete coupon
exports.deletecoupon = async (req, reply) => {
  const language = req.headers["accept-language"];
  const _coupon = await coupon.findByIdAndRemove(req.params.id);
 
  reply
  .code(200)
  .send(
    success(
      language,
      200,
      MESSAGE_STRING_ARABIC.SUCCESS,
      MESSAGE_STRING_ENGLISH.SUCCESS,
      _coupon
    )
  );};

// Update an existing adv
exports.updatecoupon = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var a = moment(req.body.dt_to);
    var b = moment(req.body.dt_from);
    var days = a.diff(b, "days");

    const _coupon = await coupon.findByIdAndUpdate(
      req.params.id,
      {
        coupon: req.body.coupon,
        dt_from: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
        dt_to: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        discount_rate: req.body.discount_rate,
        days: days,
        description: req.body.description
      },
      { new: true, runValidators: true },
      function (err, model) {
        var _return = handleError(err);
        if (_return.length > 0) {
          reply.code(200).send({
            status_code: 400,
            status: false,
            message: _return[0],
            items: _return,
          });
          return;
        }
      }
    );
    reply
    .code(200)
    .send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        _coupon
      )
    );
  } catch (err) {
    throw boom.boomify(err);
  }
};

// Check Coupon
exports.checkCouponReplacment = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {

    let obj =  await check_coupon(req.user._id,req.body.coupon, req.body.sub_category_id)
    if(obj){
      reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          obj
        )
      );
    return;
    }else{
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.COUPON_ERROR,
          MESSAGE_STRING_ENGLISH.COUPON_ERROR,
          null
        )
      );
      return;
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};


exports.checkCouponCart = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var place_id = req.headers["place"];
    var supplier_id = req.headers["supplier"];
    const tax = await setting.findOne({ code: "TAX" });
    const user_id = req.user._id;

    var totalPrice = 0.0;
    var totalDiscount = 0.0;
    var today = moment().tz("Asia/Riyadh");
    var deliverycost = 0.0;
    var expresscost = 0.0;
    var providerArr = [];
    var ar_msg = "";
    var en_msg = "";
    var statusCode = 200;
    var newPlaceId = "";
    var lat = 0.0;
    var lng = 0.0;

    const _sp = await Order.findOne({
      $and: [{ user_id: user_id }, { couponCode: req.body.coupon }],
    });

    const item = await Cart.find({
      $and: [{ user_id: user_id }],
    })
      .sort({ _id: -1 })
      .lean();

    if (item.length == 0) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.EMPTY_CART,
            MESSAGE_STRING_ENGLISH.EMPTY_CART,
            {}
          )
        );
      return;
    }

    for await (const data of item) {
      var _product = await Product.findOne({
        $and: [{ _id: data.product_id }, { isDeleted: false }],
      });
      if (_product) {
          var productObject = _product.toObject();
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

          providerArr.push(productObject);
        
        if (
          _product.sale_price &&
          _product.sale_price != 0
        ) {
          totalPrice += Number(_product.sale_price) * data.qty;
          // totalDiscount += Number( Product_Price_Object.discountPrice * data.qty);
        } 

        // deliverycost += Number(Product_Price_Object.deliveryCost) * Number(data.qty);
        // expresscost += Number(Product_Price_Object.expressCost) * Number(data.qty);
      }
    }

    var sub_total = totalPrice - totalDiscount;
    let sub_total_delivery = Number(sub_total) + Number(deliverycost);
    let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
    var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery) ;
    var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery) ;
   
    const sp = await coupon.findOne({
      $and: [
        { dt_from: { $lte: today } },
        { dt_to: { $gte: today } },
        { coupon: req.body.coupon },
        { isActive: true },
      ],
    });

    // var sub_total = totalPrice - totalDiscount;
    // var final_total =
    //   Number(sub_total * Number(tax.value)) +
    //   Number(sub_total) +
    //   Number(deliverycost);

    if (_sp) {
      var sub_total = totalPrice - totalDiscount;
      let sub_total_delivery = Number(sub_total) + Number(deliverycost);
      let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
      var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
      var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

      var returnObject = {
        // results: [],
        tax: Number(sub_total_delivery * Number(tax.value)),
        deliveryCost: Number(deliverycost),
        // expressCost: Number(expresscost),
        total_price: Number(parseFloat(totalPrice).toFixed(2)),
        total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
        final_total: Number(parseFloat(final_total).toFixed(2)),
        // final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
      };

      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.COUPON_ERROR,
            MESSAGE_STRING_ENGLISH.COUPON_ERROR,
            returnObject
          )
        );
      return;
    } else {
      if (sp) {
        let newDeliverycost = deliverycost //- Number(deliverycost * sp.discount_rate);
        let newExpresscost = expresscost //- Number(expresscost * sp.discount_rate);
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(newDeliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(newExpresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        // var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);
        
        var new_final_total = final_total - Number(final_total * sp.discount_rate);
        var new_final_express_total = final_express_total - Number(final_express_total * sp.discount_rate);

        var returnObject = {
          tax: Number(tax.value),
          deliveryCost: Number(newDeliverycost),
          // expressCost: Number(newExpresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(Number(final_total * sp.discount_rate)).toFixed(2)),
          final_total: Number(parseFloat(new_final_total).toFixed(2)),
          // final_express_total: Number(parseFloat(new_final_express_total).toFixed(2)),
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
      } else {
        var sub_total = totalPrice - totalDiscount;
        let sub_total_delivery = Number(sub_total) + Number(deliverycost);
        let sub_total_express_delivery = Number(sub_total) + Number(expresscost);
        var final_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        var final_express_total = Number(sub_total_express_delivery * Number(tax.value)) + Number(sub_total_express_delivery);

        var returnObject = {
          results: [],
          tax: Number(sub_total_delivery * Number(tax.value)),
          deliveryCost: Number(deliverycost),
          // expressCost: Number(expresscost),
          total_price: Number(parseFloat(totalPrice).toFixed(2)),
          total_discount: Number(parseFloat(totalDiscount).toFixed(2)),
          final_total: Number(parseFloat(final_total).toFixed(2)),
          // final_express_total: Number(parseFloat(final_express_total).toFixed(2)),
        };

        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.COUPON_ERROR,
              MESSAGE_STRING_ENGLISH.COUPON_ERROR,
              returnObject
            )
          );
        return;
      }
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};