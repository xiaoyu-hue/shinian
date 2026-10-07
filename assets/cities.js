/* ============================================================
   时念 · 城市列表（内联版）
   ------------------------------------------------------------
   内联引入以支持 file:// 双击打开（浏览器安全策略禁止 file:// 页面 fetch 本地 JSON，v0.3.1 修复）。

   维护方式（v0.7.4 统一）：城市数据源是 data/cities.json（含 name/pinyin/lat/lon），
   本文件由 tools/gen-cities.js 根据其生成。**规范做法**是修改 data/cities.json 后运行生成器；
   直接手改本文件的 SHINIAN_CITIES 数组亦可，但下次运行生成器会以 data/cities.json 为准覆盖本文件，
   导致手动改动丢失——请勿同时维护两处。
   ============================================================ */

var SHINIAN_CITIES = [
  {
    "name": "北京",
    "pinyin": "beijing",
    "lat": 39.9042,
    "lon": 116.4074
  },
  {
    "name": "上海",
    "pinyin": "shanghai",
    "lat": 31.2304,
    "lon": 121.4737
  },
  {
    "name": "天津",
    "pinyin": "tianjin",
    "lat": 39.3434,
    "lon": 117.3616
  },
  {
    "name": "重庆",
    "pinyin": "chongqing",
    "lat": 29.563,
    "lon": 106.5516
  },
  {
    "name": "哈尔滨",
    "pinyin": "haerbin",
    "lat": 45.8038,
    "lon": 126.535
  },
  {
    "name": "长春",
    "pinyin": "changchun",
    "lat": 43.8171,
    "lon": 125.3235
  },
  {
    "name": "沈阳",
    "pinyin": "shenyang",
    "lat": 41.8057,
    "lon": 123.4315
  },
  {
    "name": "呼和浩特",
    "pinyin": "huhehaote",
    "lat": 40.8424,
    "lon": 111.749
  },
  {
    "name": "石家庄",
    "pinyin": "shijiazhuang",
    "lat": 38.0428,
    "lon": 114.5149
  },
  {
    "name": "太原",
    "pinyin": "taiyuan",
    "lat": 37.8706,
    "lon": 112.5489
  },
  {
    "name": "济南",
    "pinyin": "jinan",
    "lat": 36.6512,
    "lon": 117.1201
  },
  {
    "name": "郑州",
    "pinyin": "zhengzhou",
    "lat": 34.7466,
    "lon": 113.6254
  },
  {
    "name": "西安",
    "pinyin": "xian",
    "lat": 34.3416,
    "lon": 108.9398
  },
  {
    "name": "兰州",
    "pinyin": "lanzhou",
    "lat": 36.0611,
    "lon": 103.8343
  },
  {
    "name": "银川",
    "pinyin": "yinchuan",
    "lat": 38.4872,
    "lon": 106.2309
  },
  {
    "name": "西宁",
    "pinyin": "xining",
    "lat": 36.6171,
    "lon": 101.7785
  },
  {
    "name": "乌鲁木齐",
    "pinyin": "wulumuqi",
    "lat": 43.8256,
    "lon": 87.6168
  },
  {
    "name": "合肥",
    "pinyin": "hefei",
    "lat": 31.8206,
    "lon": 117.2272
  },
  {
    "name": "南京",
    "pinyin": "nanjing",
    "lat": 32.0603,
    "lon": 118.7969
  },
  {
    "name": "杭州",
    "pinyin": "hangzhou",
    "lat": 30.2741,
    "lon": 120.1551
  },
  {
    "name": "武汉",
    "pinyin": "wuhan",
    "lat": 30.5928,
    "lon": 114.3055
  },
  {
    "name": "长沙",
    "pinyin": "changsha",
    "lat": 28.2282,
    "lon": 112.9388
  },
  {
    "name": "南昌",
    "pinyin": "nanchang",
    "lat": 28.682,
    "lon": 115.8582
  },
  {
    "name": "福州",
    "pinyin": "fuzhou",
    "lat": 26.0745,
    "lon": 119.2965
  },
  {
    "name": "成都",
    "pinyin": "chengdu",
    "lat": 30.5728,
    "lon": 104.0668
  },
  {
    "name": "贵阳",
    "pinyin": "guiyang",
    "lat": 26.647,
    "lon": 106.6302
  },
  {
    "name": "昆明",
    "pinyin": "kunming",
    "lat": 25.0389,
    "lon": 102.7183
  },
  {
    "name": "南宁",
    "pinyin": "nanning",
    "lat": 22.817,
    "lon": 108.3665
  },
  {
    "name": "拉萨",
    "pinyin": "lasa",
    "lat": 29.65,
    "lon": 91.1
  },
  {
    "name": "广州",
    "pinyin": "guangzhou",
    "lat": 23.1291,
    "lon": 113.2644
  },
  {
    "name": "广州·番禺",
    "pinyin": "panyu",
    "lat": 22.9375,
    "lon": 113.3544
  },
  {
    "name": "深圳",
    "pinyin": "shenzhen",
    "lat": 22.5431,
    "lon": 114.0579
  },
  {
    "name": "深圳·宝安",
    "pinyin": "baoan",
    "lat": 22.5552,
    "lon": 113.8831
  },
  {
    "name": "珠海",
    "pinyin": "zhuhai",
    "lat": 22.2707,
    "lon": 113.5767
  },
  {
    "name": "汕头",
    "pinyin": "shantou",
    "lat": 23.3541,
    "lon": 116.682
  },
  {
    "name": "佛山",
    "pinyin": "foshan",
    "lat": 23.0218,
    "lon": 113.1214
  },
  {
    "name": "韶关",
    "pinyin": "shaoguan",
    "lat": 24.8014,
    "lon": 113.5976
  },
  {
    "name": "湛江",
    "pinyin": "zhanjiang",
    "lat": 21.271,
    "lon": 110.3589
  },
  {
    "name": "肇庆",
    "pinyin": "zhaoqing",
    "lat": 23.0473,
    "lon": 112.4651
  },
  {
    "name": "江门",
    "pinyin": "jiangmen",
    "lat": 22.5787,
    "lon": 113.0819
  },
  {
    "name": "茂名",
    "pinyin": "maoming",
    "lat": 21.6632,
    "lon": 110.9254
  },
  {
    "name": "惠州",
    "pinyin": "huizhou",
    "lat": 23.1118,
    "lon": 114.4158
  },
  {
    "name": "梅州",
    "pinyin": "meizhou",
    "lat": 24.2886,
    "lon": 116.1225
  },
  {
    "name": "汕尾",
    "pinyin": "shanwei",
    "lat": 22.7863,
    "lon": 115.3753
  },
  {
    "name": "河源",
    "pinyin": "heyuan",
    "lat": 23.7437,
    "lon": 114.7004
  },
  {
    "name": "阳江",
    "pinyin": "yangjiang",
    "lat": 21.8583,
    "lon": 111.9824
  },
  {
    "name": "清远",
    "pinyin": "qingyuan",
    "lat": 23.682,
    "lon": 113.056
  },
  {
    "name": "东莞",
    "pinyin": "dongguan",
    "lat": 23.0208,
    "lon": 113.7518
  },
  {
    "name": "中山",
    "pinyin": "zhongshan",
    "lat": 22.5164,
    "lon": 113.3928
  },
  {
    "name": "潮州",
    "pinyin": "chaozhou",
    "lat": 23.6574,
    "lon": 116.622
  },
  {
    "name": "揭阳",
    "pinyin": "jieyang",
    "lat": 23.5497,
    "lon": 116.3728
  },
  {
    "name": "云浮",
    "pinyin": "yunfu",
    "lat": 22.9152,
    "lon": 112.0445
  },
  {
    "name": "三亚",
    "pinyin": "sanya",
    "lat": 18.2528,
    "lon": 109.512
  },
  {
    "name": "桂林",
    "pinyin": "guilin",
    "lat": 25.2736,
    "lon": 110.29
  },
  {
    "name": "厦门",
    "pinyin": "xiamen",
    "lat": 24.4798,
    "lon": 118.0894
  },
  {
    "name": "青岛",
    "pinyin": "qingdao",
    "lat": 36.0671,
    "lon": 120.3826
  },
  {
    "name": "大连",
    "pinyin": "dalian",
    "lat": 38.914,
    "lon": 121.6147
  }
];
