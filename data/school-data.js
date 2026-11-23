window.SCHOOL_DATA = {
  "name": "예시학교 3D 안내도",
  "intro": "건물을 누르면 층별 교실을 볼 수 있습니다. 지금 보이는 내용은 예시입니다.",
  "ground": { "width": 240, "height": 160, "image": null, "sample": true },
  "buildings": [
    {
      "id": "main", "name": "본관", "floors": 4, "floorHeight": 4, "color": "#e8c9a0",
      "desc": "교무실과 일반 교실이 모여 있는 중심 건물입니다.", "photo": null, "photoOnWalls": false,
      "outline": [[-80,-50],[10,-50],[10,-28],[-58,-28],[-58,10],[-80,10]],
      "rooms": { "1": ["행정실","교장실","보건실","현관"], "2": ["교무실","1학년 교실"], "3": ["2학년 교실","상담실"], "4": ["3학년 교실","진로활동실"] }
    },
    {
      "id": "science", "name": "과학관", "floors": 3, "floorHeight": 4, "color": "#a9cfc4",
      "desc": "실험과 탐구 수업을 하는 특별실 건물입니다.", "photo": null, "photoOnWalls": false,
      "outline": [[25,-55],[75,-55],[75,-35],[25,-35]],
      "rooms": { "1": ["물리실","화학실"], "2": ["생명과학실","지구과학실"], "3": ["컴퓨터실","메이커실"] }
    },
    {
      "id": "library", "name": "도서관", "floors": 2, "floorHeight": 4.5, "color": "#d8a7a0",
      "desc": "책을 읽고 모둠 학습을 할 수 있는 공간입니다.", "photo": null, "photoOnWalls": false,
      "outline": [[-40,-14],[-8,-14],[-8,12],[-40,12]],
      "rooms": { "1": ["열람실","대출 창구"], "2": ["모둠 학습실","디지털 자료실"] }
    },
    {
      "id": "gym", "name": "체육관", "floors": 1, "floorHeight": 10, "color": "#9fb8d8",
      "desc": "체육 수업과 학교 행사를 여는 실내 공간입니다.", "photo": null, "photoOnWalls": false,
      "outline": [[-100,28],[-50,28],[-50,62],[-100,62]],
      "rooms": { "1": ["실내 코트","무대","체육 준비실"] }
    },
    {
      "id": "cafeteria", "name": "급식실", "floors": 1, "floorHeight": 5, "color": "#e5d58b",
      "desc": "점심 식사를 하는 공간입니다.", "photo": null, "photoOnWalls": false,
      "outline": [[-36,30],[-12,30],[-12,60],[-36,60]],
      "rooms": { "1": ["식당","조리실","영양사실"] }
    }
  ]
};
