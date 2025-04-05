// External Dependancies
const boom = require("boom");
const NodeGeocoder = require("node-geocoder");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const geolib = require("geolib");
const _ = require("underscore");
const lodash = require("lodash");
const GeoFire = require("geofire");
const async = require("async");
const moment = require("moment");
const request = require("request");
const axios = require("axios");
const mongoose = require("mongoose");
const cron = require("node-cron");

// Get Data Models
const { Favorite } = require("../models/Favorite");
const { Order, Rate, Payment, Transactions } = require("../models/Order");
const { Admin } = require("../models/Admin");
// const { Point } = require("../models/Point");
// const { UserPoint } = require("../models/userPoint");
const { Notifications } = require("../models/Notifications");
const { setting, place, variation } = require("../models/Constant");
const {
  Product,
  Supplier,
  Product_Price,
  Place_Delivery,
  SubCategory,
  Supervisor,
} = require("../models/Product");
const { getCurrentDateTime } = require("../models/Constant");
const { coupon } = require("../models/Coupon");
const { tokens } = require("../models/Constant");
// const { companyCommision } = require("../models/companyCommision");
const { Users, User_Address, User_Uncovered, Wish } = require("../models/User");
const { Cart } = require("../models/Cart");
const {
  MESSAGE_STRING_ENGLISH,
  MESSAGE_STRING_ARABIC,
  LANGUAGE_ENUM,
  USER_TYPE,
  NOTIFICATION_TYPE,
  NOTIFICATION_TITILES,
  VALIDATION_MESSAGE_ARABIC,
  VALIDATION_MESSAGE_ENGLISH,
  ORDER_STATUS,
  PASSENGER_STATUS,
  ACTORS,
  PAYMENT_TYPE,
} = require("../utils/constants");
const {
  encryptPassword,
  mail_reset_password,
  makeid,
  makeOrderNumber,
  uploadImages,
  CreateGeneralNotification,
  sendSMS,
  check_request_params,
  handleError,
  CreateNotificationMultiple,
  NewPayment,
  check_coupon,
  refund,
  postM5azen,
} = require("../utils/utils");
const { success, errorAPI } = require("../utils/responseApi");
const { string, number } = require("@hapi/joi");
const { employee } = require("../models/Employee");
const { Firebase } = require("../utils/firebase");
const e = require("cors");
const { util } = require("config");
var database = Firebase.database();
var geoFire = new GeoFire(database.ref("userLocation"));
var language = "ar"
var firebaseRef = Firebase.database().ref();
 
exports.PendingCronOrders = async function PendingCronOrders() {
  // */1 * * * *
  // 0 0 1 * *
  cron.schedule(`* * * * *`, async () => {
    const currentTimestamp = Date.now();
    const currentTimestampInSeconds = Math.floor(currentTimestamp);
    const _reminder = await setting.findOne({ code: "REMINDER" });
    var today = moment().tz("Asia/Riyadh");
    let orders = await Order.find({Status: ORDER_STATUS.new}).populate("user")
    for await (const doc of orders) {
      // get diffrence
      let createdAt = moment(doc.createAt).tz('Asia/Riyadh')
      var minutes = today.diff(createdAt, "minutes");
      if(minutes >= Number(_reminder.value)) {
        var msg = `عزيزي المشرف يرجى اتخاذ الاجراء المناسب للطلب رقم: ${doc.order_no}`;
        let _place = await place.findById(doc.place);
        let _supervisors = await Supervisor.find({$and:[{place_id:_place._id},{isDeleted:false}]})
        for await(const _super of _supervisors) {
          let _check = await Notifications.find({$and:[{user_id: _super._id}, {type: NOTIFICATION_TYPE.REMINDER}, {body_parms:doc._id }]})
          if(_check.length < 3) {
            let _Notification = new Notifications({
              fromId: USER_TYPE.PANEL,
              user_id: _super._id,
              title: NOTIFICATION_TITILES.REMINDER,
              msg: msg,
              dt_date: getCurrentDateTime(),
              type: NOTIFICATION_TYPE.REMINDER,
              body_parms: doc._id,
              isRead: false,
              fromName: "",
              toName: "",
            });
            let rs = _Notification.save();
            sendSMS(_super.phone_number , "", "", msg);
          }else {
            let supplier = await Supplier.findById(_super.supplier_id);
            sendSMS(supplier.phone_number , "", "", msg);
            await Order.findByIdAndUpdate(doc._id, {status:ORDER_STATUS.canceled_by_admin}, {new:true})
            
            firebaseRef
            .child("orders")
            .child(String(req.params.id))
            .update({ timestamp: currentTimestampInSeconds, Status: ORDER_STATUS.canceled_by_admin, msg: "تم الغاء الطلب رقم " + doc.order_no}); 

            firebaseRef.child("orders").child(String(doc._id)).remove();
          }
        }

        // if(doc.paymentType == PAYMENT_TYPE.ONLINE){
        //   await refund(doc.payment_id, doc.total).then((x) => { response = x });
        // }
        // if(doc.paymentType == PAYMENT_TYPE.WALLET){
        //   await NewPayment(doc.user._id, doc.order_no , ` ارجاع مبلغ الطلب ${doc.order_no}` , '+' , doc.total , 'Online');
        // }
        await CreateGeneralNotification(doc.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, "تم الغاء الطلب بنجاح", NOTIFICATION_TYPE.ORDERS, doc._id, "", doc.user._id, "", "");  
      }
    }
  });
};

exports.addOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var validationArray = [
      { name: "couponCode" },
      { name: "PaymentType" },
      // { name: "dt_date" },
      // { name: "dt_time" },
      { name: "address" },
      { name: "is_address_book" },
    ];
    if (String(req.body.is_address_book) == "true") {
      validationArray.push({ name: "address_book" });
    } else {
      validationArray.push({ name: "lat" });
      validationArray.push({ name: "lng" });
    }
    check_request_params(req.body, validationArray, async function (response) {
      if (response.success) {
        var userId = req.user._id;
        const userObj = await Users.findById(userId);
        const tax = await setting.findOne({ code: "TAX" });

        const raduis = 1000;
        var cart_place_id = "";
        var supplier_id = "";
        var items = [];
        var total = 0.0;
        var totalDiscount = 0.0;
        var provider_Total = 0.0;
        var net_total = 0.0;
        var deliverycost = 0.0;
        var lat = 0.0;
        var lng = 0.0;
        var remain = 0.0;
        var gTax = 0.0;
        var address = "";
        var couponRate = 0.0;
        var sp = null;
        var personalDiscount = 0.0;

        var ar_msg = MESSAGE_STRING_ARABIC.SUCCESSNEW;
        var en_msg = MESSAGE_STRING_ENGLISH.SUCCESSNEW;
        var statusCode = 200;
        var employee_ids = [];

        var doc = req.body;
        var arr = [];
        var newPlaceId = "";
        arr = await Cart.find({
          $and: [{ user_id: userId }],
        });

        if (arr.length == 0) {
          // items on cart
          reply
            .code(200)
            .send(
              errorAPI(
                language,
                400,
                MESSAGE_STRING_ARABIC.EMPTY_CART,
                MESSAGE_STRING_ENGLISH.EMPTY_CART
              )
            );
          return;
        }

        if (
          String(req.body.is_address_book) == "true" &&
          req.body.address_book &&
          req.body.address_book != ""
        ) {
          var newAddress = await User_Address.findById(req.body.address_book);
          if (newAddress) {
            lat = Number(newAddress.lat);
            lng = Number(newAddress.lng);
            if (newAddress.discount != 0)
              personalDiscount = Number(newAddress.discount);
          } else {
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
        } else {
          lat = Number(req.body.lat);
          lng = Number(req.body.lng);
        }

        if (lat == 0.0  || lng == 0.0) {
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

        arr = await Cart.find({
          $and: [{ user_id: userId }],
        });

        if (arr.length == 0) {
          // items on cart
          reply
            .code(200)
            .send(
              errorAPI(
                language,
                400,
                MESSAGE_STRING_ARABIC.EMPTY_CART,
                MESSAGE_STRING_ENGLISH.EMPTY_CART
              )
            );
          return;
        }

        if (req.body.couponCode && req.body.couponCode != "") {
          // check coupon
          // var today = moment(getCurrentDateTime());
          var today = moment().tz("Asia/Riyadh");
          sp = await coupon.findOne({
            $and: [
              { dt_from: { $lt: today } },
              { dt_to: { $gt: today } },
              { coupon: req.body.couponCode },
            ],
          });
          if (!sp) {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.COUPON_ERROR,
                  MESSAGE_STRING_ENGLISH.COUPON_ERROR,
                  {}
                )
              );
            return;
          } else {
            const prevOrd = await Order.findOne({
              $and: [{ user_id: userId }, { couponCode: req.body.couponCode }],
            });
            if (prevOrd) {
              reply
                .code(200)
                .send(
                  errorAPI(
                    language,
                    400,
                    MESSAGE_STRING_ARABIC.COUPON_ERROR,
                    MESSAGE_STRING_ENGLISH.COUPON_ERROR,
                    {}
                  )
                );
              return;
            } else {
              couponRate = sp.discount_rate;
            }
          }
        }

        var admin_percentage = 0; //provider.orderPercentage;
        var by = ""
        for await (const data of arr) {
          by = data.supplier_id
          var Product_Price_Object = await Product.findOne({
            $and: [
              // { place_id: newPlaceId },
              // { supplier_id: supplier_id },
              { _id: data.product_id },
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
            let object = {
              cartId: data._id,
              product_id: data.product_id,
              variation: data.variation,
              qty: data.qty,
              Total: data.Total,
              TotalDiscount: data.TotalDiscount,
              createAt: data.createAt,
              by: Product_Price_Object.by
            };

            // if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0
            // ) {
            //   total += Number(Product_Price_Object.sale_price) * data.qty;
            //   // totalDiscount += Number( Product_Price_Object.discountPrice * data.qty);
            // } 
            // if(Product_Price_Object.type && Product_Price_Object.type == 'variable'){
            //   var variable_product = await variation.findById(data.variation_id);
            //   if(variable_product){
            //     total += Number(variable_product.regular_price) * data.qty;;
            //   }
            // }else{
              if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0) {
                total += Number(Product_Price_Object.sale_price) * data.qty;
              } 
            // }

            // if(String(req.body.isExpress) == "true"){
            //   deliverycost += Number(Product_Price_Object.expressCost) * Number(data.qty);
            // }else{
            //   deliverycost += Number(Product_Price_Object.deliveryCost) * Number(data.qty);
            // }
            
            net_total = total;
            items.push(object);
          }
        }

        // if (personalDiscount != 0)
        //   deliverycost = Number(deliverycost) - Number(personalDiscount * deliverycost);
        if (couponRate != 0.0) {
          deliverycost = deliverycost //- Number(deliverycost * couponRate);
          var sub_total = total - totalDiscount;
          let sub_total_delivery = Number(sub_total) + Number(deliverycost);
          gTax = Number(sub_total_delivery * Number(tax.value)) 
          let discounted_total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
          total = discounted_total - Number(discounted_total * couponRate);
        } else {
          var sub_total = total - totalDiscount;
          let sub_total_delivery = Number(sub_total) + Number(deliverycost);
          gTax = Number(sub_total_delivery * Number(tax.value)) 
          total = Number(sub_total_delivery * Number(tax.value)) + Number(sub_total_delivery);
        }

        // let adminValue = parseFloat(admin_percentage).toFixed(2) * parseFloat(total).toFixed(2);
        // provider_Total = parseFloat(total).toFixed(2) - parseFloat(adminValue);
        var orderNo = `${makeOrderNumber(6)}`;
        // if (keys_arr.length > 0) {
        //   employee_ids = keys_arr.map(x=>x.key);
        // } else {
        //   var emp = await employee.find({
        //     $and:[{ isDeleted: false },{supplier_id: supplier_id}]
        //   });
        //   if (emp.length > 0) employee_ids = emp.map(x=>x._id)
        // }

        // if (items && items.length == 0) {
        //   reply
        //     .code(200)
        //     .send(
        //       success(
        //         language,
        //         320,
        //         MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER_CHECK_ORDER,
        //         MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER_CHECK_ORDER
        //       )
        //     );
        //   return;
        // }

        let Orders = new Order({
          Order_no: orderNo,
          Tax: Number(gTax),
          DeliveryCost: Number(deliverycost),
          NetTotal: net_total,
          Total: total,
          TotalDiscount: totalDiscount,
          Remain: parseFloat(remain).toFixed(2),
          Admin_Total: 0.0,//adminValue,
          provider_Total: provider_Total,
          Status: ORDER_STATUS.new,
          dt_date: req.body.dt_date,
          dt_time: req.body.dt_time,
          lat: lat,
          lng: lng,
          PaymentType: req.body.PaymentType,
          couponCode: req.body.couponCode,
          user_id: userId,
          createAt: getCurrentDateTime(),
          items: items,
          address: req.body.address,
          user_id: userId,
          OrderType: req.body.OrderType,
          // place_id: newPlaceId,
          // supplier_id: supplier_id,
          is_address_book: req.body.is_address_book,
          address_book: req.body.address_book,
          supplier_id: by,
          notes: req.body.notes,
          // isExpress:req.body.isExpress
        });

        let rs = await Orders.save();
        let itemsId = items.map((x) => x.cartId);
        Cart.deleteMany({ _id: { $in: itemsId } }, function (err) {});
        let check_by = items.filter((x) => x.by == "Ma5azen");
        // if(check_by.length > 0) {
          // submit order to Ma5azen
          const item = await Order.findById(rs._id)
          .sort({ _id: -1 })
          .populate("user_id", "-token")
          .populate("employee_id", "-token")
          .populate("supplier_id")
          .populate("address_book")
          .populate({ path: "items.product_id", populate: { path: "product_id" } })
          .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
          .select();
          console.log(item)
          await postM5azen(item);
        // }
        let msg = "لديك طلب جديد";
        if (employee_ids.length > 0) {
          var current_employee = await employee.find({_id:{$in:employee_ids}});
        }

        var notifications_arr = []
        // current_employee.forEach(element => {
        //   let _Notification2 = new Notifications({
        //     fromId: userId,
        //     user_id: element._id,
        //     title: NOTIFICATION_TITILES.ORDERS,
        //     msg: msg,
        //     dt_date: getCurrentDateTime(),
        //     type: NOTIFICATION_TYPE.ORDERS,
        //     body_parms: rs._id,
        //     isRead: false,
        //     fromName: userObj.full_name,
        //     toName: element.full_name,
        //   });
        //   notifications_arr.push(_Notification2)
        // });
        //CreateNotificationMultiple(current_employee.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id)
        // await Notifications.insertMany(notifications_arr, (err, _docs) => {
        //   if (err) {
        //     return console.error(err);
        //   } else {
        //     console.log("Multiple documents inserted to Collection");
        //   }
        // });
   
        // if (place_id != newPlaceId) {
        //   ar_msg = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
        //   en_msg = MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER;
        //   statusCode = 300;
        // }

        reply.code(200).send(success(language, statusCode, ar_msg, en_msg, sp));
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

exports.addWishOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var userId = req.user._id;
      const userObj = await Users.findById(userId);
      const tax = await setting.findOne({ code: "TAX" });

      const raduis = 1000;
      var cart_place_id = "";
      var supplier_id = "";
      var items = [];
      var total = 0.0;
      var totalDiscount = 0.0;
      var provider_Total = 0.0;
      var net_total = 0.0;
      var deliverycost = 0.0;
      var lat = 0.0;
      var lng = 0.0;
      var remain = 0.0;
      var gTax = 0.0;
      var address = "";
      var couponRate = 0.0;
      var sp = null;
      var personalDiscount = 0.0;

      var ar_msg = MESSAGE_STRING_ARABIC.SUCCESSNEW;
      var en_msg = MESSAGE_STRING_ENGLISH.SUCCESSNEW;
      var statusCode = 200;
      var employee_ids = [];


      if (String(req.body.is_address_book) == "true" && req.body.address_book && req.body.address_book != "") {
        var newAddress = await User_Address.findById(req.body.address_book);
        if (newAddress) {
          lat = Number(newAddress.lat);
          lng = Number(newAddress.lng);
          if (newAddress.discount != 0)
            personalDiscount = Number(newAddress.discount);
        } else {
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
      } else {
        lat = Number(req.body.lat);
        lng = Number(req.body.lng);
      }

      if (lat == 0.0  || lng == 0.0) {
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

      var wish = await Wish.findById(req.body.wish_id)
      // var Product_Price_Object = await Product.findById(wish.product_id)
      // if(Product_Price_Object.type && Product_Price_Object.type == 'variable'){
      //   var variable_product = await variation.findById(data.variation_id);
      //   if(variable_product){
      //     total += Number(variable_product.regular_price) * data.qty;;
      //   }
      // }else{
      //   if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0) {
      //     total += Number(Product_Price_Object.sale_price) * data.qty;
      //   } 
      // }

      let objProd ={
        product_id: wish.product_id,
        variation_id: wish.variation_id,
        qty:1,
        Total: wish.total,
        TotalDiscount: 0,
        createAt: getCurrentDateTime(),
      }
      items.push(objProd);
      gTax = Number(wish.total) * Number(tax.value);
      net_total = Number(wish.total);
      total = Number(wish.total);

      var orderNo = `${makeOrderNumber(6)}`;
      let Orders = new Order({
        Order_no: orderNo,
        Tax: Number(gTax),
        DeliveryCost: Number(deliverycost),
        NetTotal: net_total,
        Total: total,
        TotalDiscount: totalDiscount,
        Remain: parseFloat(remain).toFixed(2),
        Admin_Total: 0.0,//adminValue,
        provider_Total: provider_Total,
        Status: ORDER_STATUS.new,
        dt_date: req.body.dt_date,
        dt_time: req.body.dt_time,
        lat: lat,
        lng: lng,
        PaymentType: req.body.PaymentType,
        couponCode: req.body.couponCode,
        user_id: userId,
        createAt: getCurrentDateTime(),
        items: items,
        address: req.body.address,
        user_id: userId,
        OrderType: req.body.OrderType,
        is_address_book: req.body.is_address_book,
        address_book: req.body.address_book,
        notes: req.body.notes,

        // place_id: newPlaceId,
        // supplier_id: supplier_id,
        // isExpress:req.body.isExpress
      });

      let rs = await Orders.save();
      let itemsId = items.map((x) => x.cartId);
      console.log(itemsId)
      Cart.deleteMany({ _id: { $in: itemsId } }, function (err) {});

      const item = await Order.findById(rs._id)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .select();
      console.log(item)
      await postM5azen(item);

      let msg = "لديك طلب جديد";
      if (employee_ids.length > 0) {
        var current_employee = await employee.find({_id:{$in:employee_ids}});
      }

      var notifications_arr = []
      // current_employee.forEach(element => {
      //   let _Notification2 = new Notifications({
      //     fromId: userId,
      //     user_id: element._id,
      //     title: NOTIFICATION_TITILES.ORDERS,
      //     msg: msg,
      //     dt_date: getCurrentDateTime(),
      //     type: NOTIFICATION_TYPE.ORDERS,
      //     body_parms: rs._id,
      //     isRead: false,
      //     fromName: userObj.full_name,
      //     toName: element.full_name,
      //   });
      //   notifications_arr.push(_Notification2)
      // });
      //CreateNotificationMultiple(current_employee.map(x=>x.fcmToken),NOTIFICATION_TITILES.ORDERS,msg,rs._id)
      // await Notifications.insertMany(notifications_arr, (err, _docs) => {
      //   if (err) {
      //     return console.error(err);
      //   } else {
      //     console.log("Multiple documents inserted to Collection");
      //   }
      // });
 
      // if (place_id != newPlaceId) {
      //   ar_msg = MESSAGE_STRING_ARABIC.CHANGE_PLACE_OR_SUPPLIER;
      //   en_msg = MESSAGE_STRING_ENGLISH.CHANGE_PLACE_OR_SUPPLIER;
      //   statusCode = 300;
      // }

      reply.code(200).send(success(language, statusCode, ar_msg, en_msg, sp));
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


exports.updateOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var msg = ""
      var msg2= ""
      let userId = req.user._id
      const check = await Order.findById(req.params.id).populate("user_id")
      const tax = await setting.findOne({ code: "TAX" });
      var msg_started = `السائق استلم الطلب بنجاح`;
      var msg_progress = `تم بدء تسليم الطلب بنجاح`;
      var msg_way = `الفي في الطريق اليك`;
      var msg_accpet = `تم قبول طلبكم بنجاح وسوف يتم التوصيل في اقرب وقت ممكن`;
      var msg_accpet2 = `تم تعينك على طلب جدبد`;
      var msg_updated = `تم التعديل على الطلب من قبل السائق يرجى تأكيد العملية`;
      var msg_prefinished = `تم توصيل اللى العميل يرجى تأكيد العملية`;
      var msg_finished = `تم الانتهاء من توثيل الطلب بنجاح`;
      var msg_canceled_by_driver = `تم الالغاء من قبل السائق`;
      var msg_canceled_by_user = `تم الغاء الطلب من قبل الزبون`;
      var msg_canceled_by_admin = `تم الغاء الطلب من قبل الادارة`;
      
      var today = getCurrentDateTime();
      var createAt = moment(check.createAt)
      var period = moment(today).diff(createAt,"minutes")
      const currentTimestamp = Date.now();
      const currentTimestampInSeconds = Math.floor(currentTimestamp);

      if(req.body.status == ORDER_STATUS.started) {
        msg = msg_started; 
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
    
        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "الفني استلم الطلب رقم "+ check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.progress) {
        msg = msg_progress;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
        
        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "تم البدء في تنفيذ الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.way) {
        msg = msg_way;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
       
        
        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "الفني في الطريق للطلب رقم "+ check.order_no});
      }
      if(req.body.status == ORDER_STATUS.accpeted) {
        msg = msg_accpet;
        msg2 = msg_accpet2;
        var emp = await employee.findById(req.body.employee_id);
        await Order.findByIdAndUpdate(
          req.params.id,
          {
            Status: req.body.status,
            employee_id: req.body.employee_id,
            canceled_note: req.body.canceled_note,
            period:period
          },
          { new: true }
        )
        if(emp){
          await CreateGeneralNotification(emp.fcmToken, NOTIFICATION_TITILES.ORDERS, msg2, NOTIFICATION_TYPE.ORDERS, check._id, check.user_id.fcmToken, check.user_id._id, "", "");
        }
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
      
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();

        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ employee_id: req.body.employee, timestamp: currentTimestampInSeconds, status: req.body.status , msg: "تم قبول الطلب رقم " + check.order_no}); 
        
      }
      if(req.body.status == ORDER_STATUS.updated) {
        var code = makeid(6)
        msg = msg_updated + " كود العملية هو: " + code;
        
        var subs = await SubCategory.find({_id:{$in:req.body.extra}})
        var price = 0;
        subs.forEach(element => { price += element.sale_price });
        var new_total = (Number(price) * Number(tax.value)) + Number(price)
        var new_tax = (Number(price) * Number(tax.value)) 

        await Order.findByIdAndUpdate( req.params.id, { update_code: code , extra: req.body.extra , period: period, tax: Number(new_tax)+Number(check.tax), new_total: new_total, new_tax: new_tax, Total: Number(/* The above code is declaring a variable called "new_total" in JavaScript. However, the code is incomplete and does not provide any further information about what the variable is intended to be used for or how it is being assigned a value. */
        new_total)+Number(check.total), netTotal: Number(new_total)+Number(check.total)},{ new: true })       
        await sendSMS(check.user_id.phone_number, "", "", msg)
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();

        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "تم تعديل حالة الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.prefinished) {
        var code =  makeid(6)
        msg = msg_prefinished + " كود العملية هو: " + code;

        await Order.findByIdAndUpdate( req.params.id, { update_code: code, period},{ new: true })
        await sendSMS(check.user_id.phone_number, "", "", msg)
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();

        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "بانتظار تأكيد الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.finished) {
        msg = msg_finished;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();

        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "تم تنفيذ الطلب رقم " + check.order_no}); 
      }     
      if(req.body.status == ORDER_STATUS.canceled_by_driver && check.Status != ORDER_STATUS.prefinished && check.Status != ORDER_STATUS.finished && check.Status != ORDER_STATUS.rated){
        msg = msg_canceled_by_driver;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();

        // if(check.paymentType == PAYMENT_TYPE.ONLINE){
        //   await refund(check.payment_id, check.total).then((x) => { response = x });
        // }
        // if(check.paymentType == PAYMENT_TYPE.WALLET){
        //   await NewPayment(check.user_id._id, check.order_no , ` ارجاع مبلغ الطلب ${check.order_no}` , '+' , check.total , 'Online');
        // }
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, "تم الغاء الطلب بنجاح", NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");  

        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "الفني قام بالغاء الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.canceled_by_admin && check.Status != ORDER_STATUS.prefinished && check.Status != ORDER_STATUS.finished && check.Status != ORDER_STATUS.rated){
        msg = msg_canceled_by_admin;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();

        // if(check.paymentType == PAYMENT_TYPE.ONLINE){
        //   await refund(check.payment_id, check.total).then((x) => { response = x });
        // }
        // if(check.paymentType == PAYMENT_TYPE.WALLET){
        //   await NewPayment(check.user_id._id, check.order_no , ` ارجاع مبلغ الطلب ${check.order_no}` , '+' , check.total , 'Online');
        // }

        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, "تم الغاء الطلب بنجاح", NOTIFICATION_TYPE.ORDERS, check._id, check.empemployee_idloyee, check.user_id._id, "", "");
      
        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "الادارة قام بالغاء الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.canceled_by_user){
        msg = msg_canceled_by_user;
        if(check.Status != ORDER_STATUS.new && check.Status != ORDER_STATUS.accpeted ){
          reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.CANCEL_ORDER_FAILED,
              MESSAGE_STRING_ENGLISH.CANCEL_ORDER_FAILED
            )
          );
        return;
        }
        let emplployee = await employee.findById(check.employee_id)
        if(emplployee)
          await CreateGeneralNotification(emplployee.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.user_id._id, emplployee._id, "", "");
    
          let _Notification = new Notifications({
            fromId: "",
            user_id: USER_TYPE.PANEL,
            title: NOTIFICATION_TITILES.ORDERS,
            msg: msg,
            dt_date: getCurrentDateTime(),
            type: NOTIFICATION_TYPE.ORDERS,
            body_parms: check._id,
            isRead: false,
            fromName: "",
            toName: "",
          });
          let rs = _Notification.save();

          // if(check.paymentType == PAYMENT_TYPE.ONLINE){
          //   await refund(check.payment_id, check.total).then((x) => { response = x });
          // }
          // if(check.paymentType == PAYMENT_TYPE.WALLET){
          //   await NewPayment(check.user_id._id, check.order_no , ` ارجاع مبلغ الطلب ${check.order_no}` , '+' , check.total , 'Online');
          // }

          //await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, "تم ارجاع مبلغ الطلب", NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
          await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, "تم الغاء الطلب بنجاح", NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
         
          firebaseRef
          .child("orders")
          .child(String(req.params.id))
          .update({ timestamp: currentTimestampInSeconds, Status: req.body.status , msg: "العميل قام بالغاء الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.finished || req.body.status == ORDER_STATUS.canceled_by_admin || req.body.status == ORDER_STATUS.canceled_by_driver || req.body.status == ORDER_STATUS.canceled_by_user){ 
        firebaseRef
        .child("orders")
        .child(String(req.params.id))
        .remove();    
      }

      await Order.findByIdAndUpdate( req.params.id, { Status: req.body.status, period:period, canceled_note: req.body.canceled_note },{ new: true })  
      reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          null
        )
      );
    
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOrderCode = async (req, reply) => {
  try {
    const currentTimestamp = Date.now();
    const currentTimestampInSeconds = Math.floor(currentTimestamp);
     let userId = req.user._id
     var msg_finished = `تم الانتهاء من توصيل الطلب بنجاح`;
     const check = await Order.findById(req.params.id).populate("user_id")
      var msg = ""
      if(check.Status == ORDER_STATUS.updated) {
        if(String(req.body.update_code) == String(check.update_code)) {
          await Order.findByIdAndUpdate(req.params.id, { Status: ORDER_STATUS.progress },{ new: true } )
          // firebaseRef
          // .child("orders")
          // .child(String(req.params.id))
          // .update({ timestamp: currentTimestampInSeconds, status: ORDER_STATUS.progress , msg: "تم تعديل الطلب رقم " + check.order_no}); 
          // send notification to employee 
        }else {
          reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.USER_VERIFY_ERROR,
              MESSAGE_STRING_ENGLISH.USER_VERIFY_ERROR
            )
          );
        return;
        }
      }
      else if(check.Status == ORDER_STATUS.prefinished) {
        if(String(req.body.update_code) == String(check.update_code)) {
          await Order.findByIdAndUpdate(req.params.id, { Status: ORDER_STATUS.finished },{ new: true } )
          // firebaseRef
          // .child("orders")
          // .child(String(req.params.id))
          // .update({ timestamp: currentTimestampInSeconds, status: ORDER_STATUS.finished , msg: "تم انهاء الطلب رقم " + check.order_no}); 


          // firebaseRef
          // .child("orders")
          // .child(String(req.params.id))
          // .remove();

          // send notification to employee 
          await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg_finished, NOTIFICATION_TYPE.ORDERS, check._id, check.employee_id, check.user_id._id, "", "");
        }else {
          reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.USER_VERIFY_ERROR,
              MESSAGE_STRING_ENGLISH.USER_VERIFY_ERROR
            )
          );
        return;
        }
      }
      else{
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
          null
        )
      );
    
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getUserOrder = async (req, reply) => {
  try {
    const language = req.headers["accept-language"];
    const userId = req.user._id;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    
    var query = {
      $and: [ {user_id: userId}]
    };

    if (req.query.q && req.query.q != "")
      query.$and.push({ order_no: { $regex: new RegExp(req.query.q, "i") }});

    if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.new) {
      query.$and.push({Status: {$in:[ORDER_STATUS.new ]}})
    }
    else if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.started) {
      query.$and.push({Status: {$in:[ORDER_STATUS.progress, ORDER_STATUS.started, ORDER_STATUS.accpeted, ORDER_STATUS.updated, ORDER_STATUS.way ]}})
    }
    else if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.finished) {
      query.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished ]}})
    }
    else if (req.query.status && req.query.status != "" && req.query.status.includes(ORDER_STATUS.canceled)) {
      query.$and.push({Status:{$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]} })
    }
    else{
      query.$and.push({Status: req.query.status})
    }
    
    var arr = []
    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
    .populate("user_id", "-token")
    .populate("employee_id", "-token")
    .populate("supplier_id")
    .populate("address_book")
    .populate({ path: "items.product_id", populate: { path: "product_id" } })
    .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
    .skip(page * limit)
    .limit(limit)
    .sort({ createAt: -1 });

    var arr = [];
    var products = []
    item.forEach((element) => {
      element.items.forEach(elm => {
        var el = elm.product_id.toObject();
        delete el.arName;
        delete el.enName;
        delete el.arDescription;
        delete el.enDescription;
        el.name = el[`${language}Name`];
        el.description = el[`${language}Description`];
        products.push(el);
      });
      let obj = {
        _id: element._id,
        OrderType: element.OrderType,
        Order_no: element.Order_no,
        Total: element.Total,
        Status: element.Status,
        dt_date: element.dt_date,
        dt_time: element.dt_time,
        address: element.address,
        address_book: element.address_book != null ? element.address_book : null,
        Supplier_id: element.supplier_id != null ? element.supplier_id : null,
        items: products,
      };
      arr.push(obj);
    });
    
    const response = {
      items: arr,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};

exports.getOrderTotal = async (req, reply) => {
  try {
    const tax = await setting.findOne({ code: "TAX" });
    const userId = req.user._id;
    var total = 0;
    var _coupon = req.body.coupon;
    const sp = await coupon.findOne({$and: [{ coupon: _coupon }]});
    const sub_category = await SubCategory.findById(req.body.sub_category_id);
    var total = Number(sub_category.sale_price);
    for await(var i of req.body.extra){
      const _sub_category = await SubCategory.findById(req.body.sub_category_id);
      total += Number(_sub_category.sale_price)
    }

    var discount_rate = Number(total) * Number(sp ? sp.discount_rate : 0);
    var final_total = Number(total) - discount_rate;
    var final_total_tax = (Number(final_total) * Number(tax.value)) + Number(final_total)
    var total_tax = (Number(final_total) * Number(tax.value)) 
    var obj = {
      final_total: Number(final_total_tax),
      total_before_tax: Number(total),
      discount: discount_rate,
      total_tax: total_tax
    }

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
  } catch {
    throw boom.boomify();
  }
};

exports.getOrderDetails = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var providerArr = [];
    var isRate = false;

    var rate = await Rate.findOne({
      $and: [{ order_id: req.params.id }, { type: 1 }],
    });

    if (rate) {
      isRate = true;
    }

    var item = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .lean();

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
    for await (const data of item.items) {
      var _product = await Product.findOne({ $and: [{ _id: data.product_id }, { isDeleted: false }] })

      if (_product) {
        const newObj = _product.toObject();
        const checkFavorite = await Favorite.findOne({
          $and: [{ user_id: req.user._id }, { product_id: _product._id }],
        });
        if (checkFavorite) {
          newObj.favorite_id = checkFavorite._id;
        } else {
          newObj.favorite_id = null;
        }

        delete newObj.arName;
        delete newObj.enName;
        delete newObj.arDescription;
        delete newObj.enDescription;
        newObj.name = _product[`${language}Name`];
        newObj.description = _product[`${language}Description`];
        newObj.qty = data.qty;
        newObj.Total = data.Total;
        newObj.TotalDiscount = data.TotalDiscount;

        providerArr.push(newObj);
      }
    }

    item.items = providerArr
    const response = {
      items: item,
      tax: Number(item.Tax),
      deliveryCost: Number(item.DeliveryCost),
      total_price: Number(parseFloat(item.NetTotal).toFixed(2)),
      total_discount: Number(parseFloat(item.TotalDiscount).toFixed(2)),
      final_total: Number(parseFloat(item.Total).toFixed(2)),
      isRate: isRate
    };

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          response
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addRateFromUserToEmployee = async (req, reply) => {
  try {
    let userId = req.user._id
    const ord = await Order.findById(req.params.id)
    var supplier_id = ord.supplier_id
      if (!ord) {
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
    if (ord.Status == ORDER_STATUS.finished) {
      var checkBefore = await Rate.findOne({ $and: [{ order_id: ord._id }, { supplier_id: supplier_id }, { type: 1 }] });
      if (checkBefore) {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.RATE_BEFORE,
              MESSAGE_STRING_ENGLISH.RATE_BEFORE
            )
          );
        return;
      }

      // if (!req.body.rate_from_user) {
      //   reply
      //     .code(200)
      //     .send(
      //       errorAPI(
      //         language,
      //         400,
      //         VALIDATION_MESSAGE_ARABIC.ALL_REQUIRED,
      //         VALIDATION_MESSAGE_ENGLISH.ALL_REQUIRED
      //       )
      //     );
      //   return;
      // }

      let Rates = new Rate({
        order_id: ord._id,
        user_id: userId,
        // supplier_id: supplier_id,
        rate_from_user: req.body.provider.rate,
        note_from_user: req.body.provider.note,
        createAt: getCurrentDateTime(),
        type: 1,
        products: req.body.products
      });

      let rs = await Rates.save();
      // var totalRates = await Rate.countDocuments({$and: [{ supplier_id: supplier_id }, { type: 1 }] });
      // var summation = await Rate.find({ $and: [{ supplier_id: supplier_id }, { type: 1 }] });
      // let sum = lodash.sumBy(summation, function (o) { return o.rate_from_user; });
      // let driver = await Supplier.findByIdAndUpdate(supplier_id, { rate: Number(sum / totalRates).toFixed(1)},{new:true});
      

      for await(const i of req.body.products){
        var totalRates = await Rate.countDocuments({ products: { $elemMatch: { product_id: i. product_id }}});
        var summation = await Rate.find({ products: { $elemMatch: { product_id: i. product_id }}});
        var product_sum = 0;
        for await(const it of summation){
          product_sum += lodash.sumBy(it.products, function (o) { return o.rate; });
        }
        console.log(product_sum)
        console.log(totalRates)
        await Product.findByIdAndUpdate(i.product_id, { rate: Number(product_sum / totalRates).toFixed(1)},{new:true});
      }

      await Order.findByIdAndUpdate(ord._id, { Status: ORDER_STATUS.rated });
      var msg = `تمت اضافة تقييم جديد على طلب رقم: ${ord.order_no}`;
      await CreateGeneralNotification(
        driver.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        ord._id,
        userId,
        supplier_id,
        "",
        ""
      );

      let _Notification = new Notifications({
        fromId: userId,
        user_id: USER_TYPE.PANEL,
        title: NOTIFICATION_TITILES.ORDERS,
        msg: msg,
        dt_date: getCurrentDateTime(),
        type: NOTIFICATION_TYPE.ORDERS,
        body_parms: ord._id,
        isRead: false,
        fromName: "",
        toName: "",
      });
      _Notification.save();


      reply
        .code(200)
        .send(
          success(
            language,
            200,
            MESSAGE_STRING_ARABIC.SUCCESS,
            MESSAGE_STRING_ENGLISH.SUCCESS,
            {}
          )
        );
    } else {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR_RATE,
            MESSAGE_STRING_ENGLISH.ERROR_RATE
          )
        );
      return;
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getTransaction = async (req, reply) => {
  try {
    const userId = req.user._id;

    var last_total = 0;
    var last_date = 0;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    
    const total = await Transactions.find({ user: userId }).countDocuments();
    const item = await Transactions.find({ user: userId })
    .sort({ _id: -1 })
    .populate("user_id", "-token")
    .skip(page * limit)
    .limit(limit);

    // let trans = new Transactions({
    //     order_no: "2030394",
    //     user: "5f590217ff72110024dd1686",
    //     total: 300,
    //     createAt: getCurrentDateTime(),
    //     paymentType: "Online",
    //     details: "شحن المحفظة",
    //   });
    //   await trans.save();

    const items = await Transactions.find({ user: userId }).sort({createAt:-1}).limit(1)
    const _items = await Transactions.find({ user: userId }).sort({createAt:-1})
   
    if(item.length > 0 ) {
      last_date = items[0].createAt
    }

    _items.forEach(element => {
      if(element.total)
        var num = 0
        if(element.type == '-'){
          num = -1 * Number(element.total)
        }else{
          num = Number(element.total)
        }
        last_total += num
    });

    const response = {
      items: item,
      total: last_total,
      last_date: last_date,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};


//admin
exports.getAdminTransaction = async (req, reply) => {
  try {
    const userId = req.params.id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    
    const total = await Transactions.find({ user: userId }).countDocuments();
    const item = await Transactions.find({ user: userId })
    .sort({ _id: -1 })
    .populate("user_id", "-token")
    .skip(page * limit)
    .limit(limit);

    // let trans = new Transactions({
    //     order_no: "2030394",
    //     user: "5f590217ff72110024dd1686",
    //     total: 300,
    //     createAt: getCurrentDateTime(),
    //     paymentType: "Online",
    //     details: "شحن المحفظة",
    //   });
    //   await trans.save();


    const response = {
      items: item,
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};


exports.updateOrderByAdmin = async (req, reply) => {
  try {
    const sp = await Order.findByIdAndUpdate(
      req.params.id,
      {
        StatusId: req.body.StatusId,
      },
      { new: false }
    )
      .populate("supplier_id")
      .populate("user_id");

    var msg = `تم اضافة طلب جديد اليك`;
    var msg2 = `تم قبول طلبك بنجاح`;

    if (req.body.StatusId == 4 && sp.StatusId != 4) {
      //add to transaction payments
      let currentDate = new Date();
      let currentMonth = moment(currentDate).format("MM");
      let currentYear = moment(currentDate).format("YYYY");
      var checkPayment = await PaymnetLog.findOne({
        $and: [
          {
            supplier_id: sp.supplier_id._id,
          },
          { PeriodMonth: currentMonth },
          { PeriodYear: currentYear },
        ],
      });

      if (checkPayment) {
        //update increament
        await PaymnetLog.findByIdAndUpdate(
          checkPayment._id,
          {
            $inc: {
              Total: Number(sp.Total),
              Admin_Total: Number(sp.Admin_Total),
              provider_Total: Number(sp.provider_Total),
            },
          },
          { new: true }
        );
      } else {
        //add payment logs
        let _Payment = new PaymnetLog({
          supplier_id: sp.supplier_id._id,
          Total: sp.Total,
          Admin_Total: sp.provider_Total,
          provider_Total: sp.provider_Total,
          TotalPaied: 0,
          TotalRemain: 0,
          PeriodMonth: moment(currentDate).format("MM"),
          PeriodYear: moment(currentDate).format("YYYY"),
          createAt: getCurrentDateTime(),
        });
        _Payment.save();
      }
    }

    // if (sp.user_id.isEnableNotifications == true) {
    await CreateGeneralNotification(
        sp.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg2,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        sp.supplier_id._id,
        sp.user_id._id,
        sp.supplier_id.name,
        sp.user_id.full_name
      );
    // }

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: sp,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.addOrdertoEmployee = async (req, reply) => {
  try {
    const employee = await employees.findById({ _id: req.body.employee_id });
    const sp = await Order.findByIdAndUpdate(
      req.params.id,
      {
        employee_id: req.body.employee_id,
        StatusId: 1,
      },
      { new: true }
    )
      .populate("supplier_id")
      .populate("user_id");

    var msg = `تم اضافة طلب جديد اليك`;
    var msg2 = `تم قبول طلبك بنجاح`;

    await CreateGeneralNotification(
      employee.fcmToken,
      NOTIFICATION_TITILES.ORDERS,
      msg,
      NOTIFICATION_TYPE.ORDERS,
      sp._id,
      sp.supplier_id._id,
      employee._id,
      sp.supplier_id.name,
      employee.full_name
    );

    // if (sp.user_id.isEnableNotifications == true) {
      await CreateGeneralNotification(
        sp.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg2,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        sp.supplier_id._id,
        sp.user_id._id,
        sp.supplier_id.name,
        sp.user_id.full_name
      );
    // }
    const response = {
      status_code: 200,
      status: true,
      messageAr: "تم تعديل الطلب بنجاح",
      messageEn: "Update Successfully",
      items: sp,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.adminCancelOrder = async (req, reply) => {
  try {
    const sp = await Order.findByIdAndUpdate(
      req.params.id,
      {
        StatusId: 5,
      },
      { new: true }
    )
      .populate("supplier_id", "-token")
      .populate("user_id", "-token");

    var msg2 = `عذرا ..  تم رفض طلبك `;

    // if (sp.user_id.isEnableNotifications == true) {
      await  CreateGeneralNotification(
        sp.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg2,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        sp.supplier_id._id,
        sp.user_id._id,
        sp.supplier_id.name,
        sp.user_id.full_name
      );
    // }
    const response = {
      status_code: 200,
      status: true,
      message: "تم تعديل الطلب بنجاح",
      messageAr: "تم تعديل الطلب بنجاح",
      messageEn: "Update Successfully",
      items: sp,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOrderByUser = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var userId = req.user._id;
    const orderDetails = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token");

    if (!orderDetails) {
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

    if (!req.body) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.ALL_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.ALL_REQUIRED
          )
        );
      return;
    }

    if (String(req.body.StatusId) != "5") {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.WRONG_STATUS,
            VALIDATION_MESSAGE_ENGLISH.WRONG_STATUS
          )
        );
      return;
    }

    var minutesSettings = await setting.findOne({ code: "PERIOD" });
    var date = moment(getCurrentDateTime());
    // var date = moment(getCurrentDateTime());
    var OrderCrateAt = moment(orderDetails.createAt);
    var duration = moment.duration(date.diff(OrderCrateAt));
    var minutes = duration.asMinutes();

    if (minutes < Number(minutesSettings.value)) {
      if (orderDetails.StatusId == -1 ||  orderDetails.StatusId == 1 || orderDetails.StatusId == 2) {
        if (req.body.StatusId == 5) {
          const sp = await Order.findByIdAndUpdate(
            req.params.id,
            {
              StatusId: req.body.StatusId,
            },
            {
              new: true,
            }
          );

          // notification for provider
          var msg = `قام ${orderDetails.user_id.full_name} بالغاء الطلب رقم: ${sp.Order_no}`;

          // CreateGeneralNotification(
          //   orderDetails.supplier_id.fcmToken,
          //   NOTIFICATION_TITILES.ORDERS,
          //   msg,
          //   NOTIFICATION_TYPE.ORDERS,
          //   orderDetails._id,
          //   orderDetails.user_id._id,
          //   orderDetails.supplier_id._id,
          //   orderDetails.user_id.full_name,
          //   orderDetails.supplier_id.name
          // );

          let _Notification2 = new Notifications({
            fromId: orderDetails.user_id._id,
            user_id: USER_TYPE.PANEL,
            title: NOTIFICATION_TITILES.ORDERS,
            msg: msg,
            dt_date: getCurrentDateTime(),
            type: NOTIFICATION_TYPE.ORDERS,
            body_parms: orderDetails._id,
            isRead: false,
            fromName: orderDetails.user_id.full_name,
            toName: USER_TYPE.PANEL,
          });

          _Notification2.save();

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
        }
      } else {
        reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.CANCEL_ORDER_FAILED,
              MESSAGE_STRING_ENGLISH.CANCEL_ORDER_FAILED
            )
          );
        return;
      }
      // const providerobj = await Supplier.findById(
      //   orderDetails.supplier_id._id
      // );
      // var msg = "";
      // console.log(providerobj.fcmToken);
      // if (req.body.StatusId == 5) {
      //   msg = `قام ${orderDetails.user_id.full_name} بالغاء الطلب رقم: ${orderDetails.Order_no}`;
      // } else {
      //   msg = `قام ${orderDetails.user_id.full_name} بتاكيد استلام الطلب رقم: ${orderDetails.Order_no}`;
      // }

      // CreateNotification(
      //   orderDetails.supplier_id.fcmToken,
      //   msg,
      //   orderDetails._id,
      //   orderDetails.user_id._id,
      //   orderDetails.supplier_id._id,
      //   orderDetails.user_id.full_name,
      //   orderDetails.supplier_id.name
      // );

      // const response = {
      //   status_code: 200,
      //   status: true,
      //   messageAr: "تم الغاء الطلب بنجاح",
      //   messageEn: "Order canceled sucessfully",
      //   items: sp,
      // };
      // reply.send(response);
    } else {
      let messageAr =
        "عذرا .. لقد تجاوزت الفترة المسموحة لك فيها بالغاء الطلب وهي " +
        minutesSettings.value +
        " دقيقة ";
      let messageEn =
        "Sorry .. you can't canceled order because you exceed period which is" +
        minutesSettings.value +
        " minutes";
      reply.code(200).send(errorAPI(language, 400, messageAr, messageEn));
      return;
    }
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


exports.getUserRatedOrders = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var query = {};

    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    query["type"] = 1;
    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("order_id")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate({
        path: "order_id.product_id",
        populate: { path: "product_id" },
      })
      .skip(page * limit)
      .limit(limit);
    // if (err) return handleError(err);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
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

exports.getProviderRatedOrders = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;
    var query = {};
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    query["type"] = 2;
    const total = await Rate.find(query).countDocuments();
    const item = await Rate.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("order_id")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token")
      .populate({
        path: "order_id.product_id",
        populate: { path: "product_id" },
      })
      .skip(page * limit)
      .limit(limit);
    // if (err) return handleError(err);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
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

exports.getNewOrder = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;
    const total = await Order.find({$or: [{ StatusId: 1 }, {StatusId: -1}]}).countDocuments();
    reply.send(total);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getOrdersSeacrhExcel = async (req, reply) => {
  try {
    // const admin_id = req.params.id;

    // var page = parseFloat(req.query.page, 10);
    // var limit = parseFloat(req.query.limit, 10);

    var start_date = req.body.start_date;
    var end_date = req.body.end_date;
    var query = {};

    if (end_date != "" && end_date != undefined && end_date) {
      end_date = new Date(end_date);
      end_date = end_date.setHours(23, 59, 59, 999);
      end_date = new Date(end_date);
      query = { dt_date: { $lt: end_date } };
    }
    if (start_date != "" && start_date != undefined && start_date) {
      start_date = new Date(start_date);
      start_date = start_date.setHours(0, 0, 0, 0);
      start_date = new Date(start_date);
      query = {
        dt_date: { $gte: start_date },
      };
    }
    if (
      start_date != "" &&
      start_date != undefined &&
      start_date &&
      end_date != "" &&
      end_date != undefined &&
      end_date
    ) {
      query = {
        dt_date: { $gte: start_date, $lt: end_date },
      };
    }
    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    if (req.body.StatusId && req.body.StatusId != "") {
      query["StatusId"] = req.body.StatusId;
    }

    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
    const response = {
      items: item,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};

exports.getOrdersSeacrh = async (req, reply) => {
  try {
    // const admin_id = req.params.id;

    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var start_date = req.body.start_date;
    var end_date = req.body.end_date;
    var query = {};

    if (end_date != "" && end_date != undefined && end_date) {
      end_date = new Date(end_date);
      end_date = end_date.setHours(23, 59, 59, 999);
      end_date = new Date(end_date);
      query = { dt_date: { $lt: end_date } };
    }
    if (start_date != "" && start_date != undefined && start_date) {
      start_date = new Date(start_date);
      start_date = start_date.setHours(0, 0, 0, 0);
      start_date = new Date(start_date);
      query = {
        dt_date: { $gte: start_date },
      };
    }
    if (
      start_date != "" &&
      start_date != undefined &&
      start_date &&
      end_date != "" &&
      end_date != undefined &&
      end_date
    ) {
      query = {
        dt_date: { $gte: start_date, $lt: end_date },
      };
    }
    if (req.body.supplier_id && req.body.supplier_id != "") {
      query["supplier"] = req.body.supplier_id;
    }
    if (req.body.user_id && req.body.user_id != "") {
      query["user_id"] = req.body.user_id;
    }
    if (req.body.employee_id && req.body.employee_id != "") {
      query["employee_id"] = req.body.employee_id;
    }
    if (req.body.StatusId && req.body.StatusId != "") {
      query["StatusId"] = req.body.StatusId;
    }

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .skip(page * limit)
      .limit(limit);
    const response = {
      items: item,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch {
    throw boom.boomify();
  }
};

exports.getEmployeeOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.user._id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var query = {$and:[{employee_id: userId}]};
    if (req.body.status && req.body.status != "") {
      if(req.body.status == ORDER_STATUS.finished) {
        query.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated]}})
      }
      else if(req.body.status == 'canceled' ){
        query.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        query.$and.push({Status: req.body.status})
      }
    }
    if (req.body.order_no && req.body.order_no != "")
      query.$and.push({ order_no: { $regex: new RegExp(req.body.order_no, "i") }});

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
    .populate("user_id", "-token")
    .populate("employee_id", "-token")
    .populate("supplier_id")
    .populate("address_book")
    .populate({ path: "items.product_id", populate: { path: "product_id" } })
    .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
    .skip(page * limit)
    .limit(limit)
    .sort({ createAt: -1 });

    var arr = [];
    var products = []
    item.forEach((element) => {
      element.items.forEach(elm => {
        var el = elm.product_id.toObject();
        delete el.arName;
        delete el.enName;
        delete el.arDescription;
        delete el.enDescription;
        el.name = el[`${language}Name`];
        el.description = el[`${language}Description`];
        products.push(el);
      });
      let obj = {
        _id: element._id,
        OrderType: element.OrderType,
        Order_no: element.Order_no,
        Total: element.Total,
        Status: element.Status,
        dt_date: element.dt_date,
        dt_time: element.dt_time,
        address: element.address,
        address_book: element.address_book != null ? element.address_book : null,
        User_id: element.user_id != null ? element.user_id : null,
        items: products,
      };
      arr.push(obj);
    });
    
    const response = {
      items: arr,
      status_code: 200,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      pagenation: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getEmployeeCountOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.user._id;

    const accpeted = await Order.countDocuments({$and:[{employee_id: userId},{Status:ORDER_STATUS.accpeted}]});
    const progress = await Order.find({$and:[{employee_id: userId},{Status:{$in:[ORDER_STATUS.progress, ORDER_STATUS.started, ORDER_STATUS.updated]}}]}).countDocuments();
    const finished = await Order.find({$and:[{employee_id: userId},{Status:{$in:[ORDER_STATUS.finished, ORDER_STATUS.prefinished, ORDER_STATUS.rated]}}]}).countDocuments();
    const cancelded = await Order.find({$and:[{employee_id: userId},{Status:{$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}}]}).countDocuments();
     var obj = {
        accpeted:accpeted,
        progress:progress,
        finished: finished,
        cancelded: cancelded
     }

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        obj
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


exports.getEmployeeOrderCounters = async (req, reply) => {
  try {
    let userId = req.user._id;

    var all = await Order.find({
      $and: [{ employee_id: userId }],
    }).countDocuments();
    var finished = await Order.find({
      $and: [{ employee_id: userId }, { StatusId: 4 }],
    }).countDocuments();
    var canceled = await Order.find({
      $and: [{ employee_id: userId }, { StatusId: 5 }],
    }).countDocuments();
    var running = await Order.find({
      $and: [
        { employee_id: userId },
        { $or: [{ StatusId: 2 }, { StatusId: 3 }] },
      ],
    }).countDocuments();

    var object = {
      allOrder: all,
      finished: finished,
      canceled: canceled,
      running: running,
    };
    const response = {
      status_code: 200,
      status: true,
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done successfully",
      items: object,
    };

    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOrderByEmployee = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var userId = req.user._id;
    const orderDetails = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token");

    if (!orderDetails) {
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
    if(orderDetails.employee_id && orderDetails.employee_id._id != userId){
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          VALIDATION_MESSAGE_ARABIC.ACCEPTED_BEFORE,
          VALIDATION_MESSAGE_ENGLISH.ACCEPTED_BEFORE
        )
      );
    return;
    } 
    // 1: accepted
    // 3: deliverd
    // 4: Finish

    if (!req.body) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.ALL_REQUIRED,
            VALIDATION_MESSAGE_ENGLISH.ALL_REQUIRED
          )
        );
      return;
    }

    if (
      String(req.body.StatusId) != "1" &&
      String(req.body.StatusId) != "2" &&
      String(req.body.StatusId) != "3" &&
      String(req.body.StatusId) != "4" &&
      String(req.body.StatusId) != "6" &&
      String(req.body.StatusId) != "7"
    ) {
      reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            VALIDATION_MESSAGE_ARABIC.WRONG_STATUS,
            VALIDATION_MESSAGE_ENGLISH.WRONG_STATUS
          )
        );
      return;
    }

    // notification
    var msg = "";
    if (String(req.body.StatusId) == "1" && orderDetails.StatusId == -1) {
      msg = ` تم قبول طلبكم ` + orderDetails.Order_no;
    } else if (String(req.body.StatusId) == "2" && orderDetails.StatusId == 1) {
      msg = ` جاري تجهيز طلبكم ` + orderDetails.Order_no;
    } else if (String(req.body.StatusId) == "3" && orderDetails.StatusId == 2) {
      msg = `تم البدء في توصيل الطلب ` + orderDetails.Order_no;
    } else if (String(req.body.StatusId) == "4" && orderDetails.StatusId == 3) {
      msg = `تم الانتهاء من توصيل الطلب المطلوب من طرفكم يرجى اضافة التقييم`;
    } else if (String(req.body.StatusId) == "6" && orderDetails.StatusId == 1) {
      msg = `تم رفض طلبكم ${orderDetails.Order_no}`;
    } else if (String(req.body.StatusId) == "7" && orderDetails.StatusId == 2) {
      msg = `تم الغاء طلبكم ${orderDetails.Order_no}`;
    } else {
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
    var sp;
    if(req.body.StatusId == 1){
       sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          StatusId: req.body.StatusId,
          employee_id: userId,
        },
        { new: true }
      );
    }else{
       sp = await Order.findByIdAndUpdate(
        req.params.id,
        {
          StatusId: req.body.StatusId,
        },
        { new: true }
      );
    }
  
    // if (orderDetails.user_id.isEnableNotifications == true) {
      CreateGeneralNotification(
        orderDetails.user_id.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        orderDetails._id,
        userId,
        orderDetails.user_id._id,
        "",
        orderDetails.user_id.full_name
      );
    // }

    reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          sp
        )
      );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addRateFromProviderToUser = async (req, reply) => {
  try {
    const ord = await Order.findById(req.params.id)
      .populate("user_id", "-token")
      .populate("supplier_id", "-token")
      .populate("employee_id", "-token");

    if (ord.StatusId == 4) {
      let Rates = new Rate({
        order_id: ord._id,
        user_id: ord.user_id,
        employee_id: ord.employee_id,
        supplier_id: ord.supplier_id,
        rate_from_provider_to_user: req.body.rate_from_provider_to_user,
        note_from_provider_to_user: req.body.note_from_provider_to_user,
        createAt: getCurrentDateTime(),
        type: 2,
      });

      let rs = await Rates.save();
      const response = {
        status_code: 200,
        status: true,
        messageAr: "تم اضافة تقييمك بنجاح",
        messageEn: "Rate added sucessfully",
        items: rs,
      };

      // var msg = `قام ${ord.employee.full_name} بتقييم الطلب رقم: ${ord.Order_no}`;
      // CreateNotification(
      //   ord.employee_id.fcmToken,
      //   msg,
      //   ord._id,
      //   ord.employee_id._id,
      //   ord.user_id._id,
      //   ord.employee_id.full_name,
      //   ord.user_id.full_name
      // );

      reply.code(200).send(response);
    } else {
      const response = {
        status_code: 400,
        status: false,
        messageAr: "عذرا .. لا يمكن التقييم حتى الانتهاء من توصيل الطلب",
        messageEn: "Sorry .. you can't rate righ now",
        items: null,
      };

      reply.code(200).send(response);
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getNewRatedOrder = async (req, reply) => {
  try {
    // const supplier_id = req.params.id;
    const total = await Order.find({
      $and: [{ isRate: true }, { isOpen: false }],
    }).countDocuments();
    reply.send(total);
  } catch {
    throw boom.boomify(err);
  }
};

exports.getOrdersSearchFilter = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const user_id = req.user._id;

    let query1 = {};
    var page = parseFloat(req.body.page, 10);
    var limit = parseFloat(req.body.limit, 10);

    const place_id = req.headers["place"];
    const supplier_id = req.headers["supplier"];

    if (req.body.address && req.body.address != "") {
      query1["address"] = { $regex: new RegExp(req.body.address, "i") };
    }

    if (req.body.Order_no && req.body.Order_no != "") {
      query1["Order_no"] = req.body.Order_no;
    }

    if (req.body.StatusId && req.body.StatusId != "") {
      query1["StatusId"] = req.body.StatusId;
    }

    query1["place_id"] = place_id;
    query1["StatusId"] = supplier_id;

    const total = await Order.find(query1).countDocuments();
    const item = await Order.find(query1)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .skip(page * limit)
      .limit(limit)
      .select("-couponCode");
    var arr = [];
    item.forEach((element) => {
      let obj = {
        _id: element._id,
        Order_no: element.Order_no,
        Total: element.Total,
        StatusId: element.StatusId,
        dt_date: element.dt_date,
        dt_time: element.dt_time,
        address: element.address,
        OrderType: element.OrderType,
        supplier_id: element.supplier_id,
        client_name: element.user_id.full_name ? element.user_id.full_name : "",
        client_phone: element.user_id.phone_number
          ? element.user_id.phone_number
          : "",
      };
      arr.push(obj);
    });
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        arr,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getNearstSupplierByPlace = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    //for test 24.693601, 46.66594
    const place_id = req.headers["place"];
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    const raduis = 1000;
    var keys_arr = [];
    var employeesInPlace = await employee.find({
      $and: [{ place_id: place_id }, { isAvailable: true },{ isDeleted: false }],
    });
    let geoQuery = geoFire.query({
      center: [Number(lat), Number(lng)],
      radius: raduis,
    });

    var onKeyEnteredRegistration = geoQuery.on(
      "key_entered",
      async function (key, location, distance) {
        console.log(
          key + " Key " + location + " (" + distance + " km from center)"
        );
        var employees = employeesInPlace.map((x) => String(x._id));
        if (employees.includes(key)) {
          let obj = {
            key: key,
            location: location,
            distance: distance,
          };

          if (distance <= raduis) {
            keys_arr.push(obj);
          }
        }

        keys_arr.sort(function (a, b) {
          return a.distance > b.distance;
        });
      }
    );

    var onKeyExitedRegistration = geoQuery.on(
      "ready",
      async function (key, location, distance) {
        console.log(
          key + " Key " + location + " (" + distance + " km from center)"
        );
        onKeyEnteredRegistration.cancel();
        var ids = keys_arr.map((x) => x.key);
        console.log("ids: " + ids[0]);
        if (keys_arr.length > 0) {
          await employee.find(
            { $and: [{ _id: ids[0] },{ isDeleted: false }] },
            async function (err, _users) {
              var supplier_id = _users[0].supplier_id;
              reply
                .code(200)
                .send(
                  success(
                    language,
                    200,
                    MESSAGE_STRING_ARABIC.SUCCESS,
                    MESSAGE_STRING_ENGLISH.SUCCESS,
                    supplier_id
                  )
                );
              return;
            }
          );
        } else {
          var suppliers = await Place_Delivery.findOne({
            place_id: place_id,
          });
          if (suppliers) {
            var supplier_id = suppliers.supplier_id;
            reply
              .code(200)
              .send(
                success(
                  language,
                  200,
                  MESSAGE_STRING_ARABIC.SUCCESS,
                  MESSAGE_STRING_ENGLISH.SUCCESS,
                  supplier_id
                )
              );
            return;
          } else {
            reply
              .code(200)
              .send(
                errorAPI(
                  language,
                  400,
                  MESSAGE_STRING_ARABIC.NOT_COVERED,
                  MESSAGE_STRING_ENGLISH.NOT_COVERED,
                  {}
                )
              );
            return;
          }
        }
      }
    );

    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

////////////Admin/////////////
exports.getUserOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var q = {$and:[{user_id: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }

    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getUserOrdersExcel = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var q = {$and:[{user_id: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }

    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })
    
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


exports.getProivdeOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  // try {
    let userId = req.params.id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var q = {$and:[{provider: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  // } catch (err) {
  //   reply.code(200).send(errorAPI(language, 400, err.message, err.message));
  //   return;
  // }
};

exports.getProivdeOrdersExcel = async (req, reply) => {
  const language = req.headers["accept-language"];
  // try {
    let userId = req.params.id;

    var q = {$and:[{provider: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })

      
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item
      )
    );
    return;
  // } catch (err) {
  //   reply.code(200).send(errorAPI(language, 400, err.message, err.message));
  //   return;
  // }
};
exports.getSupervisorOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var q = {$and:[{supervisor: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getSupervisorOrdersExcel = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var q = {$and:[{supervisor: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
exports.getEmployeesOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var result = [];
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    var q = {$and:[{employee_id: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
    .populate("user_id", "-token")
    .populate("employee_id", "-token")
    .populate("supplier_id")
    .populate("address_book")
    .populate({ path: "items.product_id", populate: { path: "product_id" } })
    .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item,
        {
          size: item.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getEmployeesOrderExcel = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.params.id;
    var result = [];
    var q = {$and:[{employee_id: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({Status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({Status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({Status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
    .populate("user_id", "-token")
    .populate("employee_id", "-token")
    .populate("supplier_id")
    .populate("address_book")
    .populate({ path: "items.product_id", populate: { path: "product_id" } })
    .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .sort({ _id: -1 })

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        item
      )
    );
    return;
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};


exports.getSingleOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const item = await Order.findById(req.query.id)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};
exports.getOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var query = {};
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }
    if (req.body.Status && req.body.Status != ""){
      if(req.body.Status == ORDER_STATUS.finished){
        query["Status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}
      }
      else if(req.body.Status == 'canceled' ){
        query["Status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
      }
      else{
        query["Status"] = req.body.Status;
      }
    }
    if (req.body.Order_no && req.body.Order_no != "")
      query["Order_no"] = req.body.Order_no;

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .skip(page * limit)
      .limit(limit)
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
      pagination: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrdersExcel = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var query = {};
    query["Status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }
    // if (req.body.status && req.body.status != ""){
    //   if(req.body.status == ORDER_STATUS.finished){
    //   }
    //   else if(req.body.status == 'canceled' ){
    //     query["Status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
    //   }
    //   else{
    //     query["Status"] = req.body.status;
    //   }
    // }
    if (req.body.order_no && req.body.order_no != "")
      query["Order_no"] = req.body.order_no;

    if (req.body.supplier_id && req.body.supplier_id != "")
      query["supplier_id"] = req.body.supplier_id;

    if (req.body.place_id && req.body.supplier_id != "")
      query["place"] = req.body.place_id;


    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrdersEarnings = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var _result  = []
    var query = {};
    query["Status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated]}
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }

    if (req.body.order_no && req.body.order_no != "")
      query["Order_no"] = req.body.order_no;

    if (req.body.supplier_id && req.body.supplier_id != "")
      query["supplier_id"] = req.body.supplier_id;

    if (req.body.place_id && req.body.supplier_id != "")
      query["place"] = req.body.place_id;


    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .select();

    if(req.body.supplier_id && req.body.supplier_id != ""){
        _result = lodash(item)
        .groupBy('employee')
        .map(function (platform, id) {
          if (platform && platform.length > 0) {
            if(platform[0] && platform[0].employee_id){
              console.log(platform[0].employee_id)
              return {
                id: platform[0].employee_id._id,
                title: platform[0].employee_id ? platform[0].employee_id.full_name : "",
                place: platform[0].place ? platform[0].place.arName : "",
                supervisor: platform[0].supervisor ? platform[0].supervisor.name : "",
                totalTaxs: lodash.sumBy(platform, 'tax'),
                totalDiscounts: lodash.sumBy(platform, 'totalDiscount'),
                totals: lodash.sumBy(platform, 'total')
              }
            }
          }
        })
        .value()
    }
    // if(req.body.place_id && req.body.place_id != ""){
    //   _result = lodash(item)
    //   .groupBy('place')
    //   .map(function (platform, id) {
    //     if (platform.length > 0) {
    //       if(platform[0].place){
    //         return {
    //           id: platform[0].place._id,
    //           title: platform[0].employee ? platform[0].employee.full_name : "",
    //           place: platform[0].place ? platform[0].place.arName : "",
    //           supervisor: platform[0].supervisor ? platform[0].supervisor.name : "",
    //           totalTaxs: lodash.sumBy(platform, 'tax'),
    //           totalDiscounts: lodash.sumBy(platform, 'totalDiscount'),
    //           totals: lodash.sumBy(platform, 'total')
    //         }
    //       }
    //     }
    //   })
    //   .value()
    //   console.log(_result)
    // }
    var arr = []
    _result.forEach(element => {
      if(element){
        arr.push(element)
      }
    });
    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: arr
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrdersPercentage = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var _result  = []
    var query = {};
    query["Status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated]}
    if (
      req.body.dt_from &&
      req.body.dt_from != "" &&
      req.body.dt_to &&
      req.body.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: moment(req.body.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.body.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }

    if (req.body.supplier_id && req.body.supplier_id != "")
      query["supplier_id"] = req.body.supplier_id;

    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("supplier_id")
      .select();

      _result = lodash(item)
      .groupBy('provider')
      .map(function (platform, id) {
        if (platform && platform.length > 0) {
          if(platform[0] && platform[0].provider){
            return {
              title: platform[0].provider ? platform[0].provider.name : "",
              totalAdmin: lodash.sumBy(platform, 'admin_total'),
              totalProvider: lodash.sumBy(platform, 'provider_total'),
              totals: lodash.sumBy(platform, 'total')
            }
          }
        }
      })
      .value()
    var arr = []
    _result.forEach(element => {
      if(element){
        arr.push(element)
      }
    });
    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: arr
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.deleteRate = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    const rate = await Rate.findByIdAndRemove(req.params.id);
  
    reply
      .code(200)
      .send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
      )
    );
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getOrdersRateList = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    if(req.user.userType == ACTORS.STORE || req.user.userType == ACTORS.SUPERVISOR){
      var supplier_id = ""
      if(req.user.userType == ACTORS.STORE ){
        supplier_id = req.user._id
      }
      if(req.user.userType == ACTORS.SUPERVISOR ){
        let s = await Supervisor.findById(req.user._id)
        supplier_id = s.supplier_id
      }
      let emps = await employee.find({})
      let emps_id  = emps.map(x=>x._id)
      var query = {$and:[{employee_id:{$in:emps_id}}]};
      if (
        req.body.dt_from &&
        req.body.dt_from != "" &&
        req.body.dt_to &&
        req.body.dt_to != ""
      ) {
        query = {
          createAt: {
            $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)),
            $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)),
          },
        };
      }
      const total = await Rate.find(query).countDocuments();
      const item = await Rate.find(query)
      .populate("user_id", ["-password", "-token"])
      .populate({
        path: "products",
        populate: {
          path: "product_id",
        }})
        .populate({
          path: "order_id",
          populate: {
            path: "employee_id",
          }})
        .sort({ _id: -1 })
        .skip(page * limit)
        .limit(limit);

  
      reply
        .code(200)
        .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          item,
          {
            size: item.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
          }
        )
      );
    }else{
      var query = {};
      if (
        req.body.dt_from &&
        req.body.dt_from != "" &&
        req.body.dt_to &&
        req.body.dt_to != ""
      ) {
        query = {
          createAt: {
            $gte: new Date(new Date(req.body.dt_from).setHours(0, 0, 0)),
            $lt: new Date(new Date(req.body.dt_to).setHours(23, 59, 59)),
          },
        };
      }
      const total = await Rate.find(query).countDocuments();
      const item = await Rate.find(query)
      .populate("user_id", ["-password", "-token"])
      .populate({
        path: "order_id",
        populate: {
          path: "employee_id",
        }})
      .populate({
        path: "products",
        populate: {
          path: "product_id",
        },
      })
        .sort({ _id: -1 })
        .skip(page * limit)
        .limit(limit);

      reply
        .code(200)
        .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          item,
          {
            size: item.length,
            totalElements: total,
            totalPages: Math.floor(total / limit),
            pageNumber: page,
          }
        )
      );
    }

  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getSupplierRateList = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);
    let emps = await employee.find({supplier_id: req.params.id})
    let emps_id  = emps.map(x=>x._id)
    var query = {$and:[{driver_id:{$in:emps_id}}]};
    
    const total = await Rate.countDocuments(query);
    const item = await Rate.find(query)
      .populate("user_id", ["-password", "-token"])
      .sort({ _id: -1 })
      .skip(page * limit)
      .limit(limit);
    var rateArray = [];
    for await (const data of item) {
      var newObject = data.toObject();
      const ord = await Order.findById(data.destination_id);
      if (ord) newObject.order_no = ord.Order_no;
      rateArray.push(newObject);
    }
  
    reply
      .code(200)
      .send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        rateArray,
        {
          size: rateArray.length,
          totalElements: total,
          totalPages: Math.floor(total / limit),
          pageNumber: page,
        }
      )
    );
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrdersMap = async (req, reply) => {
  try {
    let searchDate = moment()
      .add(-6, "months")
      .startOf("day")
      .tz("Asia/Riyadh");

      var query = {}
      query["dt_date"]= { $gte: searchDate } 
      query["Status"] = req.query.status_id;
      
      

    console.log(query)
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
    // .limit(2000)
    // if (err) return handleError(err);
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      messageAr: "تمت العملية بنجاح",
      messageEn: "Done Successfully",
      items: item,
    };
    reply.send(response);
  } catch(err) {
    throw boom.boomify(err);
  }
};


///////// m5azen /////////
exports.getAdminOrders = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var page = parseFloat(req.query.page, 10);
    var limit = parseFloat(req.query.limit, 10);

    var query = {};
    if (
      req.query.dt_from &&
      req.query.dt_from != "" &&
      req.query.dt_to &&
      req.query.dt_to != ""
    ) {
      query = {
        createAt: {
          $gte: moment(req.query.dt_from).tz("Asia/Riyadh").startOf("day"),
          $lt: moment(req.query.dt_to).tz("Asia/Riyadh").endOf("day"),
        },
      };
    }
    if (req.query.Status && req.query.Status != ""){
      if(req.query.Status == ORDER_STATUS.finished){
        query["Status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}
      }
      else if(req.query.Status == 'canceled' ){
        query["Status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
      }
      else{
        query["Status"] = req.query.Status;
      }
    }
    if (req.query.Order_no && req.query.Order_no != "")
      query["Order_no"] = req.query.Order_no;

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user_id", "-token")
      .populate("employee_id", "-token")
      .populate("supplier_id")
      .populate("address_book")
      .populate({ path: "items.product_id", populate: { path: "product_id" } })
      .populate({ path: "items.variation_id", populate: { path: "variation_id" } })
      .skip(page * limit)
      .limit(limit)
      .select();

    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: item,
      pagination: {
        size: item.length,
        totalElements: total,
        totalPages: Math.floor(total / limit),
        pageNumber: page,
      },
    };
    reply.code(200).send(response);
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.getOrderStatus = async (req, reply) => {
  var status = [
    ORDER_STATUS.new,
    ORDER_STATUS.accpeted, 
    ORDER_STATUS.canceled,
    ORDER_STATUS.canceled_by_admin,
    ORDER_STATUS.canceled_by_driver,
    ORDER_STATUS.canceled_by_user,
    ORDER_STATUS.finished,
    ORDER_STATUS.prefinished,
    ORDER_STATUS.progress,
    ORDER_STATUS.rated, 
    ORDER_STATUS.started,
    ORDER_STATUS.updated, 
    ORDER_STATUS.way
  ]

  const response = {
    status_code: 200,
    status: true,
    message: "تمت العملية بنجاح",
    items: status,
  };
  reply.send(response);
}

exports.updateMa5azenOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var msg = ""
      const check = await Order.findById(req.params.id).populate("user_id")
      const tax = await setting.findOne({ code: "TAX" });
      var msg_started = `السائق استلم الطلب بنجاح`;
      var msg_progress = `تم بدء تسليم الطلب بنجاح`;
      var msg_way = `الفي في الطريق اليك`;
      var msg_accpet = `تم قبول طلبكم بنجاح وسوف يتم التوصيل في اقرب وقت ممكن`;
      var msg_accpet2 = `تم تعينك على طلب جدبد`;
      var msg_finished = `تم الانتهاء من توثيل الطلب بنجاح`;
     
      var today = getCurrentDateTime();
      var createAt = moment(check.createAt)
      var period = moment(today).diff(createAt,"minutes")
      const currentTimestamp = Date.now();
      const currentTimestampInSeconds = Math.floor(currentTimestamp);

      if(req.body.status == ORDER_STATUS.started) {
        msg = msg_started; 
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
      }
      if(req.body.status == ORDER_STATUS.progress) {
        msg = msg_progress;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
        
        // firebaseRef
        // .child("orders")
        // .child(String(req.params.id))
        // .update({ timestamp: currentTimestampInSeconds, status: req.body.status , msg: "تم البدء في تنفيذ الطلب رقم " + check.order_no}); 
      }
      if(req.body.status == ORDER_STATUS.way) {
        msg = msg_way;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
      }
      if(req.body.status == ORDER_STATUS.accpeted) {
        msg = msg_accpet;
        msg2 = msg_accpet2;
        var emp = await employee.findById(req.body.employee_id);
        await Order.findByIdAndUpdate(
          req.params.id,
          {
            Status: req.body.status,
            employee_id: null,
            canceled_note: "",
            period: period
          },
          { new: true }
        )
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
      
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
      }
      if(req.body.status == ORDER_STATUS.finished) {
        msg = msg_finished;
        await CreateGeneralNotification(check.user_id.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, "", check.user_id._id, "", "");
        let _Notification = new Notifications({
          fromId: check.user_id._id,
          user_id: USER_TYPE.PANEL,
          title: NOTIFICATION_TITILES.ORDERS,
          msg: msg,
          dt_date: getCurrentDateTime(),
          type: NOTIFICATION_TYPE.ORDERS,
          body_parms: check._id,
          isRead: false,
          fromName: "",
          toName: "",
        });
        let rs = _Notification.save();
      }

      await Order.findByIdAndUpdate( req.params.id, { Status: req.body.status, period:period, canceled_note: req.body.canceled_note },{ new: true })  
      reply
      .code(200)
      .send(
        success(
          language,
          200,
          MESSAGE_STRING_ARABIC.SUCCESS,
          MESSAGE_STRING_ENGLISH.SUCCESS,
          null
        )
      );
    
  } catch (err) {
    throw boom.boomify(err);
  }
};


//payment getway
exports.checkout = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    var userId = req.user._id;
    var givenName = "";
    var surName = "";
    var orderNo = `${makeOrderNumber(6)}`;
    const tax = await setting.findOne({ code: "TAX" });

    // var amount = 0;
    var _id = new mongoose.Types.ObjectId().toHexString();
    var amount = Number(req.body.amount).toFixed(2);
    var tax_amount = Number(amount)*Number(tax.value)
    let userData = await Users.findById(userId);

    givenName = userData.full_name.trim();
    surName = userData.full_name.trim();
    //tye: 1:visa , 2:mada, 3:apple
  
    var items = []
    for await(var i of req.body.products) {
      const Product_Price_Object = await Product.findById(i.product_id);
      var enName = Product_Price_Object.enName;
      var _total_price = 0;
      var _tax_amount = 0;
      // if(Product_Price_Object.type && Product_Price_Object.type == 'variable'){
      //   var variable_product = await variation.findById(i.variation_id);
      //   if(variable_product){
      //     _total_price = Number(variable_product.regular_price) * Number(i.qty)
      //     _tax_amount = Number(variable_product.regular_price) * Number(tax.value)
      //   }
      // }else{
        if (Product_Price_Object.sale_price && Product_Price_Object.sale_price != 0) {
          _total_price = Number(Product_Price_Object.sale_price) * Number(i.qty)
          _tax_amount = Number(Product_Price_Object.sale_price) * Number(tax.value)
        } 
      // }

      var obj =   {
        "name": enName,
        "type": "Digital",
        "reference_id": Product_Price_Object._id,
        "sku": Product_Price_Object.SKU,
        "quantity": Number(i.qty),
        "discount_amount": {
          "amount": 0,
          "currency": "SAR"
        },
        "tax_amount": {
          "amount": Number(_tax_amount),
          "currency": "SAR"
        },
        "total_amount": {
          "amount": Number(_total_price),
          "currency": "SAR"
        }
      }
      items.push(obj)
    }

    console.log(items)
    var body = {
      "total_amount": {
        "amount": Number(amount),
        "currency": "SAR"
      },
      "shipping_amount": {
        "amount": 0,
        "currency": "SAR"
      },
      "tax_amount": {
        "amount": tax_amount,
        "currency": "SAR"
      },
      "order_reference_id": orderNo,
      "order_number": orderNo,
      "discount": {
        "name": "",
        "amount": {
          "amount": 0,
          "currency": "SAR"
        }
      },
      "items": items,
      "consumer": {
        "email": userData.email,
        "first_name": givenName ,
        "last_name": surName,
        "phone_number": userData.phone_number
      },
      "country_code": "SA",
      "description": "description",
      "merchant_url": {
        "cancel": "https://www.google.com",
        "failure": "https://www.google.com",
        "success": "https://www.wishy.com",
        "notification": "https://www.wishy.com"
      },
      "payment_type": "PAY_BY_INSTALMENTS",
      "instalments": 3,
      "billing_address": {
        "city": "Riyadh",
        "country_code": "SA",
        "first_name": givenName,
        "last_name": surName,
        "line1": "Riyadh",
        "line2": "",
        "phone_number": userData.phone_number,
        "region": ""
      },
      "shipping_address": {
        "city": "Riyadh",
        "country_code": "SA",
        "first_name": givenName,
        "last_name": surName,
        "line1": "Riyadh",
        "line2": "",
        "phone_number": userData.phone_number,
        "region": ""
      },
      "platform": "Wishy",
      "is_mobile": true,
      "locale": "en_US"
    }

    console.log(body)
    var url = `https://api.tamara.co/checkout`
    let _config = {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhY2NvdW50SWQiOiIwNDI2ZWMyMC0xOWMzLTQxNzEtOTA0Zi1mYWIyZjdlY2UzM2MiLCJ0eXBlIjoibWVyY2hhbnQiLCJzYWx0IjoiZmIzMzIyM2Y3MzFmNTQ4MGI0YzhlYTM1NDg5MTFjNTUiLCJyb2xlcyI6WyJST0xFX01FUkNIQU5UIl0sImlhdCI6MTcxMjUxNTM0OCwiaXNzIjoiVGFtYXJhIFBQIn0.doK9s4_Cp7UApXOb31Y2DBcWKLXbU4X0ju-IF7Tlh3wx2VQwm5wctUAU2-75Kdvp7XRKXew2Vx79CEE-JZZqd5qQ3D3zeFnShA-16tLrsjolpVbfI0dY6lsE8vbL7-Ge93vsIYQ9T8G4V8SzH_h7J_C532pJ-C8MW7gzTH9GRlaTA7FHWMWoR332hmTuA8L_qPuHUUY7KHtOUgGv6rhXJPGHz8Tx-rMEoxyTOmZuEM905BbR_wmpToyvAZGoJ1mxosCwBdwb1Giw5YhmXPpTUAGs13OwmqqAo-Tlm70nSNp6CwrMqNf_RRszgoNwIXQfSOT0rPQUvpiZSwmcchCKQg",
      },
    };

  

    axios
      .post(url, body, _config)
      .then(async (response) => {
        console.log(response.data);
        // let result = response.data;
        // var obj = result;
        // obj.payment_order_id = _id;
        // obj.order_no = orderNo;
        // obj.amount = final_total;
        // var regex1 = /^(000\.000\.|000\.100\.1|000\.[36])/;
        // var regex2 = /^(000\.400\.0[^3]|000\.400\.100)/;
        // var regex3 = /^(000\.200)/;
        // var regex4 = /^(800\.400\.5|100\.400\.500)/;
        // if (
        //   regex1.test(result.result.code) ||
        //   regex2.test(result.result.code) ||
        //   regex3.test(result.result.code) ||
        //   regex4.test(result.result.code)
        // ) {
        //   const response = {
        //     items: obj,
        //     status: true,
        //     status_code: 200,
        //     messageAr: result.result.description,
        //     messageEn: result.result.description,
        //   };
        //   reply.code(200).send(response);
        // } else {
        //   const response = {
        //     items: obj,
        //     status: false,
        //     status_code: 400,
        //     messageAr: result.result.description,
        //     messageEn: result.result.description,
        //   };
        //   reply.code(200).send(response);
        //   return;
        // }

        var obj = response.data;
        obj.orderNo = orderNo
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
      })
      .catch((error) => {
        reply.code(200).send(errorAPI(language, 400, MESSAGE_STRING_ARABIC.ERROR, MESSAGE_STRING_ENGLISH.ERROR));
        return;
      });
  } catch (err) {
    throw boom.boomify(err);
  }
};