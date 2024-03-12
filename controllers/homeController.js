const boom = require("boom");
const lodash = require("lodash");

const { Admin } = require("../models/Admin");
const { Users } = require("../models/User");
const { Order, Rate } = require("../models/Order");
const { Supplier, Product, Product_Price, Category, SubCategory } = require("../models/Product");
const { USER_TYPE, ORDER_STATUS, ACTORS } = require("../utils/constants");
const { employee } = require("../models/Employee");

exports.getTop10NewUsers = async (req, reply) => {
  try {
    const item = await Users.find()
      .populate("city_id")
      .populate("country_id")
      .limit(7)
      .sort({ _id: -1 });
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getTop10Orders = async (req, reply) => {
  try {
    var query = {$and:[{status: ORDER_STATUS.new}]};
    query["status"] = ORDER_STATUS.new
    if(req.user.userType == ACTORS.STORE){
      query.$and.push({provider: req.user._id}) 
    }
    console.log(query)
    const item = await Order.find(query)
      .populate("user", "-token")
      .populate({ path: "extra", populate: { path: "subcategory" } })
      .populate("employee", "-token")
      .populate("supervisor", "-token")
      .populate("provider")
      .populate("sub_category_id")
      .populate("category_id")
      .populate("address")
      .limit(10)
      .sort({ _id: -1 });
    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: item,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getCounterOrdersWithStatus = async (req, reply) => {
  try {
    if (req.user.userType == ACTORS.ADMIN) {
      const NewOrder = await Order.countDocuments({ status: ORDER_STATUS.new })
      const ProccessingOrder = await Order.countDocuments({$or: [{ status: ORDER_STATUS.started }, { status: ORDER_STATUS.accpeted }, { status: ORDER_STATUS.updated }, { status: ORDER_STATUS.progress }]});
      const DoneOrder = await Order.countDocuments({ $or:[{status: ORDER_STATUS.prefinished }, {status: ORDER_STATUS.finished }, {status: ORDER_STATUS.rated }]})
      const CancelOrder = await Order.countDocuments({$or: [{ status: ORDER_STATUS.canceled_by_driver }, { status: ORDER_STATUS.canceled_by_admin }, { status: ORDER_STATUS.canceled_by_user }]})
      const AllOrder = await Order.countDocuments({});
      const Accepted = await Order.countDocuments({ $and: [{ status: ORDER_STATUS.accpeted }],});
      const Updated = await Order.countDocuments({ $and: [{ status: ORDER_STATUS.updated }],});

      const response = {
        status_code: 200,
        status: true,
        message: "تمت العملية بنجاح",
        NewOrder: NewOrder,
        ProccessingOrder: ProccessingOrder,
        DoneOrder: DoneOrder,
        CancelOrder: CancelOrder,
        AllOrder: AllOrder,
        Accepted: Accepted,
        Updated: Updated,
      };
      reply.send(response);
    }
    else if (req.user.userType == ACTORS.STORE){
      let provider_id = req.user._id;
      const NewOrder = await Order.countDocuments({ $and: [{ status: ORDER_STATUS.new }, { provider: provider_id }],});
      const ProccessingOrder = await Order.countDocuments({ $or:[{status: ORDER_STATUS.accpeted }, {status: ORDER_STATUS.progress }, {status: ORDER_STATUS.updated }, {status: ORDER_STATUS.started }]});
      const DoneOrder = await Order.countDocuments({$and: [{$or: [{status: ORDER_STATUS.prefinished }, {status: ORDER_STATUS.finished }, {status: ORDER_STATUS.rated }]}, { provider: provider_id }]});
      const CancelOrder = await Order.countDocuments({$and: [{$or: [{status: ORDER_STATUS.canceled_by_admin }, {status: ORDER_STATUS.canceled_by_driver }, {status: ORDER_STATUS.canceled_by_user }]}, { provider: provider_id }]});
      const AllOrder = await Order.countDocuments({provider: provider_id});
      const Accepted = await Order.countDocuments({ $and: [{ status: ORDER_STATUS.accpeted }, { provider: provider_id }],});
      const Updated = await Order.countDocuments({ $and: [{ status: ORDER_STATUS.updated }, { provider: provider_id }],});

      const response = {
        status_code: 200,
        status: true,
        message: "تمت العملية بنجاح",
        NewOrder: NewOrder,
        ProccessingOrder: ProccessingOrder,
        DoneOrder: DoneOrder,
        CancelOrder: CancelOrder,
        AllOrder: AllOrder,
        Accepted: Accepted,
        Updated: Updated,
      };
      reply.send(response);
    }
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getCounterUsers = async (req, reply) => {
  try {
    const _Supplier = await Supplier.find({isDeleted:false}).countDocuments();
    const _employee = await employee.find({isDeleted:false}).countDocuments();
    const _Users = await Users.find().countDocuments();
    const _Admin = await Admin.find().countDocuments();
    const New = await Order.find({
      $and: [{ OrderType: 1 }, { StatusId: 4 }],
    }).countDocuments();
    const Replacment = await Order.find({
      $and: [{ OrderType: 2 }, { StatusId: 4 }],
    }).countDocuments();

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      Users: _Users,
      Supplier: _Supplier,
      Employee: _employee,
      Admins: _Admin,
      Replacment: Replacment,
      New: New,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getCounter2 = async (req, reply) => {
  try {
    const _Order = await Order.countDocuments({status:{$in:[ORDER_STATUS.finished, ORDER_STATUS.rated]}})
    const _Rate = await Rate.countDocuments({});
    const _Category = await Category.countDocuments({isDeleted:false});
    const _SubCategory = await SubCategory.countDocuments({isDeleted: false});

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      Order: _Order,
      Rate: _Rate,
      Category: _Category,
      SubCategory: _SubCategory,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.UsersproviderPerYear = async (req, reply) => {
  try {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    var items = [];
    var items2 = [];
    const result = await Users.find().sort({ createAt: 1 });
    const result2 = await employee.find().sort({ createAt: 1 });
    result.forEach((element) => {
      var month_number = new Date(element.createAt).getMonth();
      var month_year = new Date(element.createAt).getFullYear();
      let current_year = new Date().getFullYear()
      var month_name = monthNames[month_number];
      if(month_year == current_year){
        items.push({ month: month_name, user: element._id });
      }
    });

    result2.forEach((element) => {
      var month_number = new Date(element.createAt).getMonth();
      var month_year = new Date(element.createAt).getFullYear();
      let current_year = new Date().getFullYear()
      var month_name = monthNames[month_number];
      if(month_year == current_year){
        items2.push({ month: month_name, user: element._id });
      }
    });

    var _result = lodash(items)
      .groupBy("month")
      .map(function (items, _name) {
        return { name: _name, value: items.length };
      })
      .value();

      var _result2 = lodash(items2)
      .groupBy("month")
      .map(function (items, _name) {
        return { name: _name, value: items.length };
      })
      .value();

    var orderedResult = lodash.orderBy(_result, ["count"], ["desc"]);
    var orderedResult2 = lodash.orderBy(_result2, ["count"], ["desc"]);

    const response = {
      items: [
        { name: "مستخدم جديد", series: orderedResult },
        { name: "فني جديد", series: orderedResult2 },
      ],
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getTopProductsCategory = async (req, reply) => {
  try {
    var query = {};
    // if (req.user.userType != USER_TYPE.ADMIN)
    //   query["provider_id"] = req.user._id;

    query["isDeleted"] = false;
    // query["isActive"] = true;
    var products = [];
    const item = await Product.find(query).populate("category_id");
    item.forEach((element) => {
      products.push(element);
    });

    var _result = lodash(products)
      .groupBy("category_id._id")
      .map(function (items, _name) {
        if (items.length > 0)
          return { name: items[0].category_id.arName, value: items.length };
      })
      .value();

    var orderedResult = lodash.orderBy(_result, ["count"], ["desc"]);
    var FinalResult = lodash.take(orderedResult, 10);

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: FinalResult,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getProviderTarget = async (req, reply) => {
  try {
    const item = await Order.find({status:{$in:[ORDER_STATUS.finished, ORDER_STATUS.rated]}})
    .populate("provider");

    var _result = lodash(item)
      .groupBy("provider._id")
      .map(function (items, _name) {
        if (items.length > 0)
          return { name: `${items[0].provider.name} (${items[0].provider.target})`, value: items.length };
      })
      .value();

    var orderedResult = lodash.orderBy(_result, ["count"], ["desc"]);

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: orderedResult,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};


exports.getTopProductsPlace = async (req, reply) => {
  try {
    var query = {};
    // if (req.user.userType != USER_TYPE.ADMIN)
    //   query["provider_id"] = req.user._id;
    // query["isDeleted"] = false;
    query["status"] = {$in:[ORDER_STATUS.finished,ORDER_STATUS.prefinished, ORDER_STATUS.rated]};
    var products = [];
    const item = await Order.find(query)
      .populate("place")
    item.forEach((element) => {
      products.push(element);
    });

    console.log(item)
    var _result = lodash(item)
      .groupBy("place._id")
      .map(function (items, _name) {
        if (items.length > 0) {
        if(items[0].place){
          return { name: items[0].place.arName, value: items.length };
        }
      }
      })
      .value();

    var orderedResult = lodash.orderBy(_result, ["count"], ["desc"]);
    var FinalResult = lodash.take(orderedResult, 10);

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: FinalResult,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};

exports.getProviderOrdersPerYear = async (req, reply) => {
  try {
    var query = {};
    // if (req.user.userType != USER_TYPE.ADMIN)
    //   query["provider_id"] = req.user._id;
    // query["isDeleted"] = false;
    query["status"] = {$in:[ORDER_STATUS.finished,ORDER_STATUS.prefinished, ORDER_STATUS.rated]};
    var products = [];
    const item = await Order.find(query)
      .populate("sub_category_id")
    item.forEach((element) => {
      products.push(element);
    });

    console.log(item)
    var _result = lodash(item)
      .groupBy("sub_category_id._id")
      .map(function (items, _name) {
        if (items.length > 0) {
        if(items[0].place){
          return { name: items[0].sub_category_id.arName, value: items.length };
        }
      }
      })
      .value();

    var orderedResult = lodash.orderBy(_result, ["count"], ["desc"]);
    var FinalResult = lodash.take(orderedResult, 10);

    const response = {
      status_code: 200,
      status: true,
      message: "تمت العملية بنجاح",
      items: FinalResult,
    };
    reply.send(response);
  } catch (err) {
    throw boom.boomify(err);
  }
};
// exports.getProviderOrdersPerYear = async (req, reply) => {
//   try {
//     var supplier_arr = [];
//     var orderedResult = [];
//     var count = 0;
//     var query = {};
//     if (req.params.id != null && req.params.id != "") {
//       query["_id"] = req.params.id;
//     }
//     var sup = await Supplier.find({
//       $and: [{ isDeleted: false }, query],
//     }).countDocuments();
//     const result = await Supplier.find({ $and: [{ isDeleted: false }, query] });

//     result.forEach(async function (element) {
//       var cancelOrder = await Order.find({
//         $and: [{ supplier_id: element._id }, { StatusId: { $in: [4, 5, 6] } }],
//       }).countDocuments();
//       var DoneOrder = await Order.find({
//         $and: [{ supplier_id: element._id }, { StatusId: 4 }],
//       }).countDocuments();
//       var allOrders = await Order.find({
//         supplier_id: element._id,
//       }).countDocuments();

//       orderedResult.push(
//         {
//           name: "الطلبات الملغية",
//           value: cancelOrder,
//         },
//         {
//           name: "الطلبات المكتملة",
//           value: DoneOrder,
//         },
//         {
//           name: "الطلبات الكلية",
//           value: allOrders,
//         }
//       );

//       supplier_arr.push({
//         name: element.name,
//         series: orderedResult,
//       });
//       orderedResult = [];
//       count++;
//       if (count === sup) {
//         count = 0;

//         reply.send(supplier_arr);
//         // reply.end()
//       }
//     });
//   } catch (err) {
//     throw boom.boomify(err);
//   }
// };
