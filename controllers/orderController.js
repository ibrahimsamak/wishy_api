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

// Get Data Models
const { Favorite } = require("../models/Favorite");
const { Order, Rate, Payment, Transactions } = require("../models/Order");
const { Admin } = require("../models/Admin");
// const { Point } = require("../models/Point");
// const { UserPoint } = require("../models/userPoint");
const { Notifications } = require("../models/Notifications");
const { setting, place } = require("../models/Constant");
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
const { Users, User_Address, User_Uncovered } = require("../models/User");
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
} = require("../utils/utils");
const { success, errorAPI } = require("../utils/responseApi");
const { string, number } = require("@hapi/joi");
const { employee } = require("../models/Employee");
const { Firebase } = require("../utils/firebase");
const e = require("cors");
var database = Firebase.database();
var geoFire = new GeoFire(database.ref("userLocation"));
var language = "ar"


exports.addOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var total = 0
      var total_discount = 0
      var total_tax = 0
      
      var validationArray = [
        { name: "couponCode" },
        { name: "paymentType" },
        { name: "category_id" },
        { name: "sub_category_id" },
        { name: "dt_date" },
        { name: "dt_time" },
      ];

      validationArray.push({ name: "lat" });
      validationArray.push({ name: "lng" });
      check_request_params(req.body, validationArray, async function (response) {
        if (response.success) {
          var userId = req.user._id;
          const userObj = await Users.findById(userId);
          const tax = await setting.findOne({ code: "TAX" });
          const sub_category = await SubCategory.findById(req.body.sub_category_id);
          var orderNo = `${makeOrderNumber(6)}`;
          var _supplier = null;
          var _employee = null;

          var PoinInPolygon = await place.find({
            $and: [
              {
                loc: {
                  $geoIntersects: {
                    $geometry: {
                      type: "Point",
                      coordinates: [Number(req.body.lng), Number(req.body.lat)],
                    },
                  },
                },
              },
              { isDeleted: false },
            ],
          });
          if (PoinInPolygon.length == 0) {
            let rs = new User_Uncovered({
              user_id: userId,
              user_type: "",
              lat: req.body.lat,
              lng: req.body.lng,
              address: req.body.address,
            });
            await rs.save();

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

          let check_category= await Product_Price.findOne({$and:[{place_id:PoinInPolygon[0]._id}, {category_id:req.body.category_id}]})
          if(!check_category){
            let rs = new User_Uncovered({
              user_id: userId,
              user_type: "",
              lat: req.body.lat,
              lng: req.body.lng,
              address: req.body.address,
            });
            await rs.save();

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

          _supplier = check_category.supplier_id 

          if(req.body.couponCode && req.body.couponCode != ""){
            let obj =  await check_coupon(req.user._id, req.body.couponCode, req.body.sub_category_id)
            if(obj == null){
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
            total = obj.final_total;
            total_discount = obj.discount;
            total_tax = obj.total_tax
          }else{
            total = (Number(sub_category.price) * Number(tax.value)) + Number(sub_category.price)
            total_tax = (Number(sub_category.price) * Number(tax.value))
          }
          var address = req.body.address;
          if(!req.body.address || req.body.address == ""){
            let rs = new User_Address({
              title: req.body.title,
              lat: req.body.lat,
              lng: req.body.lng,
              address: req.body.address,
              user_id: userId,
              isDefault: false,
              discount: 0,
              streetName: req.body.streetName,
              floorNo: req.body.floorNo,
              buildingNo: req.body.buildingNo,
              flatNo: req.body.flatNo,
              type: 'home'
            });
        
            let _rs = await rs.save();
            address = _rs._id;
          }
          let Orders = new Order({
            lat: req.body.lat,
            lng: req.body.lng,           
            price: sub_category.price,
            address: address,
            order_no: orderNo,
            tax: Number(total_tax),
            total: total,
            totalDiscount: total_discount,
            netTotal: total,
            status: ORDER_STATUS.new,
            createAt: getCurrentDateTime(),
            dt_date: req.body.dt_date,
            dt_time: req.body.dt_time,
            sub_category_id: req.body.sub_category_id,
            category_id: req.body.category_id,
            addressType: req.body.addressType,
            couponCode: req.body.couponCode,
            paymentType: req.body.paymentType,
            user: userId,
            notes: req.body.notes,
            canceled_note:"",
            employee: null,
            provider: _supplier,
            supervisor: null,
            place: PoinInPolygon[0]._id,
            extra: [],
            loc: {
              type: "Point",
              coordinates: [req.body.lat, req.body.lng],
            },
          });

          let rs = await Orders.save();
          reply
          .code(200)
          .send(
            success(
              language,
              200,
              MESSAGE_STRING_ARABIC.SUCCESS,
              MESSAGE_STRING_ENGLISH.SUCCESS,
              {_id: rs._id}
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

exports.addOffer = async (req, reply) => {
  try {
    let userId = req.user._id
    const checkOrder = await Order.findById(req.params.id);
    let _userObj = await Users.findById(userId);

    if(!checkOrder) {
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

    let userIds = checkOrder.offers.map(x=>String(x.user))
    if(userIds.includes(String(userId))){
      reply
      .code(200)
      .send(
        errorAPI(
          language,
          400,
          MESSAGE_STRING_ARABIC.EXIT,
          MESSAGE_STRING_ENGLISH.EXIT
        )
      );
    return;
    }else{ 
      if(checkOrder.status != ORDER_STATUS.new){
          reply
          .code(200)
          .send(
            errorAPI(
              language,
              400,
              MESSAGE_STRING_ARABIC.OFFER_ERROR,
              MESSAGE_STRING_ENGLISH.OFFER_ERROR
            )
          );
          return;
      }
              
      if(req.body.orderType == 1 && Number(req.body.price) > Number(_userObj.walllet)){
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.WALLET,
            MESSAGE_STRING_ENGLISH.WALLET,
            null
          )
        );
      return;
      }

      if(req.body.orderType == 2 && _userObj.hasCar != true){
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.NOCAR,
            MESSAGE_STRING_ENGLISH.NOCAR,
            null
          )
        );
      return;
      }

      if(checkOrder.orderType == 1 && Number(req.body.price) >= Number(checkOrder.min_price) && Number(req.body.price) <= Number(checkOrder.max_price)){
       let offer = {
        user:      userId,
        f_address: req.body.f_address,
        t_address: req.body.t_address,
        f_lat:     req.body.f_lat,
        f_lng:     req.body.f_lng,
        t_lat:     req.body.t_lat,
        t_lng:     req.body.t_lng,
        price:     Number(req.body.price),
        notes:     req.body.notes,
        status:    PASSENGER_STATUS.add_offer,
        dt_date:   req.body.dt_date,
        dt_time:   req.body.dt_time,
      }
      const sp = await Order.findByIdAndUpdate(
          req.params.id,
          {
            $push: { offers: offer } ,
          },
          { new: true }
       )

        var msg = `تم اضافة عرض على طلبك`;
        var msg2 = `تم قبول طلبك بنجاح`;
    
        let userObj = await Users.findById(sp.user);
        await CreateGeneralNotification(
          userObj.fcmToken,
          NOTIFICATION_TITILES.ORDERS,
          msg,
          NOTIFICATION_TYPE.ORDERS,
          sp._id,
          userId,
          userObj._id,
          "",
          userObj.full_name
        );

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
        return
      }else if (checkOrder.orderType == 2){
        let offer = {
          user:      userId,
          f_address: req.body.f_address,
          t_address: req.body.t_address,
          f_lat:     req.body.f_lat,
          f_lng:     req.body.f_lng,
          t_lat:     req.body.t_lat,
          t_lng:     req.body.t_lng,
          price:     Number(req.body.price),
          notes:     req.body.notes,
          status:    PASSENGER_STATUS.add_offer,
          dt_date:   req.body.dt_date,
          dt_time:   req.body.dt_time,
        }
        const sp = await Order.findByIdAndUpdate(
            req.params.id,
            {
              $push: { offers: offer } ,
            },
            { new: true }
         )

        var msg = `تم اضافة عرض على طلبك`;
        var msg2 = `تم قبول طلبك بنجاح`;
    
        let userObj = await Users.findById(sp.user);
        await CreateGeneralNotification(
          userObj.fcmToken,
          NOTIFICATION_TITILES.ORDERS,
          msg,
          NOTIFICATION_TYPE.ORDERS,
          sp._id,
          userId,
          userObj._id,
          "",
          userObj.full_name
        );

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
        return
      }else{
        reply
        .code(200)
        .send(
          errorAPI(
            language,
            400,
            MESSAGE_STRING_ARABIC.ERROR_PRICE,
            MESSAGE_STRING_ENGLISH.ERROR_PRICE
          )
        );
      return;
      }
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.updateOffer = async (req, reply) => {
  try {
      let userId = req.user._id
      const sp = await Order.findOneAndUpdate(
         {
            $and:[
              {_id: req.params.id}, 
              { offers: { $elemMatch: { _id: req.body.offer} }}
            ]
         },
         {
          $set: {
            "offers.$.status": req.body.status
          }
         },
         { new: true }
      )

      // var msg = `تم اضافة طلب جديد اليك`;
      var msg = ""
      var msg_accpet = `تم قبول عرضك على الطلب بنجاح`;
      var msg_reject = `تم رفض عرضك على الطلب`;
      // var msg_attend = `تم حضور الزبون بنجاح`;
      // var msg_not_attend = `بم يتم حضور الزبون `;
      
      if(req.body.status == PASSENGER_STATUS.accept_offer){
        msg = msg_accpet;
        if(sp.orderType != 1){
          await Order.findByIdAndUpdate(sp._id, { status: ORDER_STATUS.accpeted }, { new: true } )
        }
      }
      if(req.body.status == PASSENGER_STATUS.reject_offer){
        msg = msg_reject;
      }

      // if(req.body.status == 'attend'){
      //   msg = msg_attend;
      // }
      // if(req.body.status == 'not_attend'){
      //   msg = msg_not_attend;
      // }

      var to_userId = sp.offers.find(x=>x._id == req.body.offer)
      var userObj = await Users.findById(to_userId.user)
      
      await CreateGeneralNotification(
        userObj.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        sp._id,
        userId,
        userObj._id,
        "",
        ""
      );
  
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

exports.updateOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
      var msg = ""
      var msg2= ""
      let userId = req.user._id
      const check = await Order.findById(req.params.id).populate("user")
      const tax = await setting.findOne({ code: "TAX" });
      var msg_started = `الفني في الطريق اليك الطلب بنجاح`;
      var msg_progress = `تم البدء في تنفيذ الطلب بنجاح`;
      var msg_accpet = `تم قبول طلبكم بنجاح وسوف يتم التنفيذ في اقرب وقت ممكن`;
      var msg_accpet2 = `تم تعينك لتقديم خدمة`;
      var msg_updated = `تم التعديل على الطلب من قبل الفني يرجى تأكيد العملية`;
      var msg_prefinished = `تم تنفيذ الخدمة من قبل العميل يرجى تأكيد العملية`;
      var msg_finished = `تم الانتهاء من تنفيذ الطلب بنجاح`;
      var msg_canceled_by_driver = `تم الالغاء من قبل الفني`;
      var msg_canceled_by_user = `تم الغاء الطلب من قبل الزبون`;
      var msg_canceled_by_admin = `تم الغاء الطلب من قبل الادارة`;
      
      if(req.body.status == ORDER_STATUS.progress) {
        msg = msg_progress;
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.started) {
        msg = msg_started; 
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.accpeted) {
        msg = msg_accpet;
        msg2 = msg_accpet2;
        var emp = await employee.findById(req.body.employee);
        await Order.findByIdAndUpdate(
          req.params.id,
          {
            status: req.body.status,
            employee: req.body.employee,
            supervisor: emp ? emp.supervisor_id : null,
            canceled_note: req.body.canceled_note
          },
          { new: true }
        )
        if(emp){
          await CreateGeneralNotification(emp.fcmToken, NOTIFICATION_TITILES.ORDERS, msg2, NOTIFICATION_TYPE.ORDERS, check._id, check.user.fcmToken, check.user._id, "", "");
        }
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.updated) {
        var code = "1234"; // makeid(6)
        msg = msg_updated + " كود العملية هو: " + code;
        
        var subs = await SubCategory.find({_id:{$in:req.body.extra}})
        var price = 0;
        subs.forEach(element => { price += element.price });
        var new_total = (Number(price) * Number(tax.value)) + Number(price)
        var new_tax = (Number(price) * Number(tax.value)) 

        await Order.findByIdAndUpdate( req.params.id, { update_code: code , extra: req.body.extra , tax: Number(new_tax)+Number(check.tax), new_total: new_total, new_tax: new_tax, total: Number(/* The above code is declaring a variable called "new_total" in JavaScript. However, the code is incomplete and does not provide any further information about what the variable is intended to be used for or how it is being assigned a value. */
        new_total)+Number(check.total), netTotal: Number(new_total)+Number(check.total)},{ new: true })       
        await sendSMS(check.user.phone_number, "", "", msg)
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.prefinished) {
        var code =  "1234";//makeid(6)
        msg = msg_prefinished + " كود العملية هو: " + code;

        await Order.findByIdAndUpdate( req.params.id, { update_code: code},{ new: true })
        await sendSMS(check.user.phone_number, "", "", msg)
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.finished) {
        msg = msg_finished;
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }     
      if(req.body.status == ORDER_STATUS.canceled_by_driver && check.status != ORDER_STATUS.prefinished && check.status != ORDER_STATUS.finished && check.status != ORDER_STATUS.rated){
        msg = msg_canceled_by_driver;
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.canceled_by_admin && check.status != ORDER_STATUS.prefinished && check.status != ORDER_STATUS.finished && check.status != ORDER_STATUS.rated){
        msg = msg_canceled_by_admin;
        await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
      }
      if(req.body.status == ORDER_STATUS.canceled_by_user){
        msg = msg_canceled_by_user;
        if(check.status != ORDER_STATUS.new && check.status != ORDER_STATUS.accpeted ){
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
        let emplployee = await employee.findById(check.employee)
        if(emplployee)
          await CreateGeneralNotification(emplployee.fcmToken, NOTIFICATION_TITILES.ORDERS, msg, NOTIFICATION_TYPE.ORDERS, check._id, check.user._id, emplployee._id, "", "");
      }
      await Order.findByIdAndUpdate( req.params.id, { status: req.body.status },{ new: true })

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
     let userId = req.user._id
     var msg_finished = `تم الانتهاء من تنفيذ الطلب بنجاح`;
     const check = await Order.findById(req.params.id).populate("user")
      var msg = ""
      if(check.status == ORDER_STATUS.updated) {
        if(String(req.body.update_code) == String(check.update_code)) {
          await Order.findByIdAndUpdate(req.params.id, { status: ORDER_STATUS.started },{ new: true } )
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
      else if(check.status == ORDER_STATUS.prefinished) {
        if(String(req.body.update_code) == String(check.update_code)) {
          await Order.findByIdAndUpdate(req.params.id, { status: ORDER_STATUS.finished },{ new: true } )
          // send notification to employee 
          await CreateGeneralNotification(check.user.fcmToken, NOTIFICATION_TITILES.ORDERS, msg_finished, NOTIFICATION_TYPE.ORDERS, check._id, check.employee, check.user._id, "", "");
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
      $and: [ {user: userId}]
    };

    if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.new) {
      query.$and.push({ status: {$in:[ORDER_STATUS.new ]}})
    }
    if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.started) {
      query.$and.push({ status: {$in:[ORDER_STATUS.progress, ORDER_STATUS.started, ORDER_STATUS.accpeted, ORDER_STATUS.updated ]}})
    }
    if (req.query.status && req.query.status != "" && req.query.status === ORDER_STATUS.finished) {
      query.$and.push({ status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished ]}})
    }
    if (req.query.status && req.query.status != "" && req.query.status.includes(ORDER_STATUS.canceled)) {
      query.$and.push({ status:{$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]} })
    }
    
    var arr = []
    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
    .populate("user", "-token")
    .populate({ path: "extra", populate: { path: "subcategory" } })
    .populate("employee", "-token")
    .populate("supervisor", "-token")
    .populate("provider")
    .populate("sub_category_id")
    .populate("category_id")
    .populate("address")
      .skip(page * limit)
      .limit(limit)
      .sort({ createAt: -1 });

      var items = []
    item.forEach(element => {
      var arr = []
      var obj = element.toObject();
      delete obj.sub_category_id;
      delete obj.category_id;
      delete obj.extra;
      obj.sub_category_id = {
        _id: element.sub_category_id._id,
        title: element.sub_category_id[`${language}Name`],
        description: element.sub_category_id[`${language}Description`],
        price: element.sub_category_id.price,
        image: element.sub_category_id.image
      }
      obj.category_id = {
        _id: element.category_id._id,
        title: element.category_id[`${language}Name`],
        description: element.category_id[`${language}Description`],
        image: element.category_id.image
      }
      element.extra.forEach(_element => {
        var _obj = {
          _id: _element._id,
          title: _element[`${language}Name`],
          price: _element.price
        }
        arr.push(_obj)
      });
      obj.extra = arr;
      items.push(obj);
    });
    
    const response = {
      items: items,
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
    var total = Number(sub_category.price);
    for await(var i of req.body.extra){
      const _sub_category = await SubCategory.findById(req.body.sub_category_id);
      total += Number(_sub_category.price)
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
    var rate = await Rate.findOne({
      $and: [{ order_id: req.params.id }, { type: 1 }],
    });

    if (rate) {
      isRate = true;
    }
      
    var item = await Order.findById(req.params.id)
    .populate("user", "-token")
    .populate({ path: "extra", populate: { path: "subcategory" } })
    .populate("employee", "-token")
    .populate("provider")
    .populate("sub_category_id")
    .populate("category_id")
    .populate("address")
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
    var obj = item;
    var arr = []
    var subCategoryObj = {
      _id: obj.sub_category_id._id,
      title: obj.sub_category_id[`${language}Name`],
      price: obj.price
    }
    var categoryObj = {
      _id: obj.category_id._id,
      title: obj.category_id[`${language}Name`],
    }
    obj.extra.forEach(element => {
      var _obj = {
        _id: element._id,
        title: element[`${language}Name`],
        price: element.price
      }
      arr.push(_obj)
    });
    obj.sub_category_id = subCategoryObj
    obj.category_id = categoryObj
    obj.extra = arr

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
  } catch (err) {
    reply.code(200).send(errorAPI(language, 400, err.message, err.message));
    return;
  }
};

exports.addRateFromUserToEmployee = async (req, reply) => {
  try {
    let userId = req.user._id
    const ord = await Order.findById(req.params.id)
    var driver_id = ord.employee
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
    if (ord.status == ORDER_STATUS.finished) {
      var checkBefore = await Rate.findOne({ $and: [{ order_id: ord._id }, { driver_id: driver_id }, { type: 1 }] });
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

      if (!req.body.rate_from_user) {
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

      let Rates = new Rate({
        order_id: ord._id,
        user_id: userId,
        driver_id: driver_id,
        rate_from_user: req.body.rate_from_user,
        note_from_user: req.body.note_from_user,
        createAt: getCurrentDateTime(),
        type: 1,
      });

      let rs = await Rates.save();
      var totalRates = await Rate.countDocuments({$and: [{ driver_id: driver_id }, { type: 1 }] });
      var summation = await Rate.find({ $and: [{ driver_id: driver_id }, { type: 1 }] });
      let sum = lodash.sumBy(summation, function (o) { return o.rate_from_user; });
      let driver = await employee.findByIdAndUpdate(driver_id, { rate: Number(sum / totalRates).toFixed(1)},{new:true});
      
      let all_supplier_employees_count = await employee.countDocuments({supplier_id: driver.supplier_id});
      let all_supplier_employees = await employee.find({supplier_id: driver.supplier_id});
      let all_supplier_employees_summation = lodash.sumBy(all_supplier_employees, function (o) { return o.rate; });   
      let supp = await Supplier.findByIdAndUpdate(driver.supplier_id, { rate: Number(all_supplier_employees_summation / all_supplier_employees_count).toFixed(1)},{new:true});
      
      let all_supervisor_employees_count = await employee.countDocuments({supervisor_id: driver.supervisor_id});
      let all_supervisor_employees = await employee.find({supervisor_id: driver.supervisor_id});
      let all_supervisor_employees_summation = lodash.sumBy(all_supervisor_employees, function (o) { return o.rate; });   
      let _supervisor = await Supervisor.findByIdAndUpdate(driver.supervisor_id, { rate: Number(all_supervisor_employees_summation / all_supervisor_employees_count).toFixed(1)},{new:true});
      

      await Order.findByIdAndUpdate(ord._id, { status: ORDER_STATUS.rated });
      var msg = `تمت اضافة تقييم جديد على طلب رقم: ${ord.order_no}`;
      await CreateGeneralNotification(
        driver.fcmToken,
        NOTIFICATION_TITILES.ORDERS,
        msg,
        NOTIFICATION_TYPE.ORDERS,
        ord._id,
        userId,
        driver_id,
        "",
        ""
      );

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
    .populate("user", "-token")
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
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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

    var query = {$and:[{employee: userId}]};
    if (req.body.status && req.body.status != "") {
      if(req.body.status == ORDER_STATUS.finished) {
        query.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.body.status == 'canceled' ){
        query.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        query.$and.push({status: req.body.status})
      }
    }
    if (req.body.order_no && req.body.order_no != "")
      query["order_no"] = req.body.order_no;

    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
      .skip(page * limit)
      .limit(limit)
      .select("-couponCode");


      var items = []
    item.forEach(element => {
      var arr = []
      var obj = element.toObject();
      delete obj.sub_category_id;
      delete obj.category_id;
      delete obj.extra;
      obj.sub_category_id = {
        _id: element.sub_category_id._id,
        title: element.sub_category_id[`${language}Name`],
        description: element.sub_category_id[`${language}Description`],
        price: element.sub_category_id.price,
        image: element.sub_category_id.image
      }
      obj.category_id = {
        _id: element.category_id._id,
        title: element.category_id[`${language}Name`],
        description: element.category_id[`${language}Description`],
        image: element.category_id.image
      }
      element.extra.forEach(_element => {
        var _obj = {
          _id: _element._id,
          title: _element[`${language}Name`],
          price: _element.price
        }
        arr.push(_obj)
      });
      obj.extra = arr;
      items.push(obj);
    });

    reply.code(200).send(
      success(
        language,
        200,
        MESSAGE_STRING_ARABIC.SUCCESS,
        MESSAGE_STRING_ENGLISH.SUCCESS,
        items,
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

exports.getEmployeeCountOrder = async (req, reply) => {
  const language = req.headers["accept-language"];
  try {
    let userId = req.user._id;

    const accpeted = await Order.countDocuments({$and:[{employee: userId},{status:ORDER_STATUS.accpeted}]});
    const progress = await Order.find({$and:[{employee: userId},{status:{$in:[ORDER_STATUS.progress, ORDER_STATUS.started, ORDER_STATUS.updated]}}]}).countDocuments();
    const finished = await Order.find({$and:[{employee: userId},{status:{$in:[ORDER_STATUS.finished, ORDER_STATUS.prefinished, ORDER_STATUS.rated]}}]}).countDocuments();
    const cancelded = await Order.find({$and:[{employee: userId},{status:{$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}}]}).countDocuments();
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
        messageAr: "عذرا .. لا يمكن التقييم حتى الانتهاء من الخدمة",
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
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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

    var q = {$and:[{user: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }

    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
    var q = {$and:[{user: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }

    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
      .populate("place")
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
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
      .populate("place")
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
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }
    const item = await Order.find(q)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
      .populate("place")
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
    var q = {$and:[{employee: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
    var q = {$and:[{employee: userId}]}
    if(req.query.status && req.query.status != ""){
      if(req.query.status == ORDER_STATUS.finished){
        q.$and.push({status: {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}})
      }
      else if(req.query.status == 'canceled' ){
        q.$and.push({status: {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}})
      }
      else{
        q.$and.push({status:req.query.status})
      }
    }
    const total = await Order.find(q).countDocuments();
    const item = await Order.find(q)
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("provider")
      .populate("supervisor")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
    if (req.body.status && req.body.status != ""){
      if(req.body.status == ORDER_STATUS.finished){
        query["status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}
      }
      else if(req.body.status == 'canceled' ){
        query["status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
      }
      else{
        query["status"] = req.body.status;
      }
    }
    if (req.body.order_no && req.body.order_no != "")
      query["order_no"] = req.body.order_no;

    if (req.body.supplier_id && req.body.supplier_id != "")
      query["provider"] = req.body.supplier_id;

    if (req.body.place_id && req.body.supplier_id != "")
      query["place"] = req.body.place_id;


    const total = await Order.find(query).countDocuments();
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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

    if (req.body.status && req.body.status != ""){
      if(req.body.status == ORDER_STATUS.finished){
        query["status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}
      }
      else if(req.body.status == 'canceled' ){
        query["status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
      }
      else{
        query["status"] = req.body.status;
      }
    }
    if (req.body.order_no && req.body.order_no != "")
      query["order_no"] = req.body.order_no;

    if (req.body.supplier_id && req.body.supplier_id != "")
      query["provider"] = req.body.supplier_id;

    if (req.body.place_id && req.body.supplier_id != "")
      query["place"] = req.body.place_id;


    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
      .populate("place")
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

    if (req.body.status && req.body.status != ""){
      if(req.body.status == ORDER_STATUS.finished){
        query["status"] = {$in:[ORDER_STATUS.finished, ORDER_STATUS.rated, ORDER_STATUS.prefinished]}
      }
      else if(req.body.status == 'canceled' ){
        query["status"] = {$in:[ORDER_STATUS.canceled_by_admin, ORDER_STATUS.canceled_by_driver, ORDER_STATUS.canceled_by_user]}
      }
      else{
        query["status"] = req.body.status;
      }
    }

    if (req.body.order_no && req.body.order_no != "")
      query["order_no"] = req.body.order_no;

    if (req.body.supplier_id && req.body.supplier_id != "")
      query["provider"] = req.body.supplier_id;

    if (req.body.place_id && req.body.supplier_id != "")
      query["place"] = req.body.place_id;


    const item = await Order.find(query)
      .sort({ _id: -1 })
      // .populate("user", "-token")
      // .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      // .populate("provider")
      .populate("place")
      // .populate("category_id")
      // .populate("address")
      .select();

    if(req.body.supplier_id && req.body.supplier_id != ""){
        _result = lodash(item)
        .groupBy('employee')
        .map(function (platform, id) {
          if (platform.length > 0) {
            if(platform[0].employee){
              return {
                id: platform[0].employee._id,
                title: platform[0].employee ? platform[0].employee.full_name : "",
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
    const response = {
      status: true,
      code: 200,
      message: "تمت العملية بنجاح",
      items: _result
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
      let emps = await employee.find({supplier_id: supplier_id})
      let emps_id  = emps.map(x=>x._id)
      var query = {$and:[{driver_id:{$in:emps_id}}]};
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
      .populate("order_id")
      .populate("user_id", ["-password", "-token"])
      .populate("driver_id", ["-password", "-token"])
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
      .populate("order_id")
      .populate("user_id", ["-password", "-token"])
      .populate("driver_id", ["-password", "-token"])
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
      query["status"] = req.query.status_id;
      
      

    console.log(query)
    const item = await Order.find(query)
      .sort({ _id: -1 })
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
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
