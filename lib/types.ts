export type ZhihuVideoItem = {
  target: {
    title_area: {
      text: string;
    };
    link: {
      url: string;
    };
  };
};

export type Question = {
  title: string;
  url: string;
};

export type ZhihuVideoList = {
  data: ZhihuVideoItem[];
};

export type ZhihuQuestionItem = {
  target: {
    title: string;
    id: number;
  };
};

export type ZhihuQuestionList = {
  data: ZhihuQuestionItem[];
};

export type SearchWord = {
  query: string;
  display_query: string;
  url?: string;
  hotScore?: number;
};

export type TopSearch = {
  top_search: {
    words: SearchWord[];
  };
};

export type Word = {
  title: string;
  url: string;
  realurl?: string;
  /** 热度数值；越大越热，跨 source 含义不同（百度热搜分、微博讨论数等），仅用于排序。 */
  hotScore?: number;
};

export type ToutiaoTopSearch = {
  data: [
    {
      words: ToutiaoWord[];
    },
  ];
};

export type ToutiaoWord = {
  word: string;
  url: string;
  hotScore?: number;
  params?: {
    fake_click_cnt?: number;
    real_click_cnt?: number;
  };
};
