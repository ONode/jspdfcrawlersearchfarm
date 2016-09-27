/*
 * Calaca - Search UI for Elasticsearch
 * https://github.com/romansanchez/Calaca
 * http://romansanchez.me
 * @rooomansanchez
 * 
 * v1.2.0
 * MIT License
 */
String.prototype.trunc = String.prototype.trunc || function (n) {
    var char_chinese = /[\u4E00-\u9FCC\u3400-\u4DB5\uFA0E\uFA0F\uFA11\uFA13\uFA14\uFA1F\uFA21\uFA23\uFA24\uFA27-\uFA29]|[\ud840-\ud868][\udc00-\udfff]|\ud869[\udc00-\uded6\udf00-\udfff]|[\ud86a-\ud86c][\udc00-\udfff]|\ud86d[\udc00-\udf34\udf40-\udfff]|\ud86e[\udc00-\udc1d]/;

    var isChinese = char_chinese.test(this);
    var delim = isChinese ? '…' : '&hellip;';
    return (this.length > n) ? this.substr(0, n - 1) + delim : this;
  };

function truncateOnWord(str, limit) {
  var trimmable = '\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u2028\u2029\u3000\uFEFF';
  var reg = new RegExp('(?=[' + trimmable + '])');
  var words = str.split(reg);
  var count = 0;
  return words.filter(function (word) {
    count += word.length;
    return count <= limit;
  }).join('');
}
function toStringBlock(list) {
  var str = "";
  for (var i = 0; i < list.length; i++) {
    str += list[i];
  }
  return str;
}
/* Service to Elasticsearch */
Calaca.factory('calacaService', ['$q', 'esFactory', '$location', '$http', function ($q, elasticsearch, $location, $http) {
    //Set default url if not configured
    CALACA_CONFIGS.url = (CALACA_CONFIGS.url.length > 0) ? CALACA_CONFIGS.url : $location.protocol() + '://' + $location.host() + ":9200";
    var client = elasticsearch({host: CALACA_CONFIGS.url});
    var index_prefix = CALACA_CONFIGS.index_name;
    var getYr = function (input) {
      var n = (input.year == null || input.year == "") ? "*" : input.year;
      //  console.log(index_prefix + n);
      return index_prefix + n;
    };
    var queryDetail = function (text) {
      // analyzer: "smartcn",
      /* return {
       query: {match: {content: text}},
       fields: ["content"],
       default_operator: "and",
       highlight: {
       pre_tags: ["<b>"],
       post_tags: ["</b>"],
       fields: {
       content: {}
       }
       }
       };*/
      return {
        query: text,
        fields: ["content"],
        default_operator: "and"
      };
    };
    var queryPerson = function (speaker_name) {
      return {
        query: speaker_name,
        fields: ["speaker"],
        default_operator: "and"
      };
    };
    var detailQuery = function (line, person) {
      return {
        constant_score: {
          filter: {
            bool: {
              must: [
                {simple_query_string: queryDetail(line)},
                {simple_query_string: queryPerson(person)}
              ]
            }
          }
        }
      }
    };
    var queryDetailPerson = function (person) {
      return {
        simple_query_string: queryPerson(person)
      }
    };
    var search = function (queryobject, mode, offset) {
      var deferred = $q.defer();
      var basic_search_obj = {
        index: getYr(queryobject),
        type: CALACA_CONFIGS.type,
        body: {
          size: CALACA_CONFIGS.size,
          query: {},
          from: offset,
          highlight: {
            pre_tags: ["<b>"],
            post_tags: ["</b>"],
            fields: {
              content: {
                type: "plain"
              }
            },
            order: "score"
          }
        }
      };
      var line = "";
      if (queryobject.query == null) {
        line = "";
      } else {
        line = queryobject.query;
      }
      if (queryobject.honourable != null && queryobject.honourable != "" && line.length > 0) {
        basic_search_obj.body.query = detailQuery(line, queryobject.honourable);
      }
      if (line.length > 0 && queryobject.honourable == null) {
        basic_search_obj.body.query.simple_query_string = queryDetail(line);
      }
      if (line.length == 0 && queryobject.honourable != null) {
        basic_search_obj.body.query.simple_query_string = queryDetailPerson(queryobject.honourable);
      }
      if (line.length == 0 && basic_search_obj.body.query.term == {}) {
        deferred.resolve({timeTook: 0, hitsCount: 0, hits: []});
        return deferred.promise;
      }
      console.log(basic_search_obj);
      // console.log(JSON.stringify(basic_search_obj.body));
      client.search(basic_search_obj).then(function (result) {
        var i = 0, hitsIn, hitsOut = [], source;
        hitsIn = (result.hits || {}).hits || [];
        console.log(result);
        for (; i < hitsIn.length; i++) {
          //console.log(hitsIn[i].highlight.content);
          //hitsIn[i]._source.content = toStringBlock(hitsIn[i].highlight.content);
          hitsIn[i]._source.content = toStringBlock(hitsIn[i]._source.content);
          //hitsIn[i]._source.content = hitsIn[i]._source.content.trunc(1000);
          //hitsIn[i]._source.content=hitsIn[i].hightlight.content;
          //console.log(hitsIn[i]);
          source = hitsIn[i]._source;
          source._id = hitsIn[i]._id;
          source._index = hitsIn[i]._index;
          source._type = hitsIn[i]._type;
          source._score = hitsIn[i]._score;
          hitsOut.push(source);
        }
        deferred.resolve({timeTook: result.took, hitsCount: result.hits.total, hits: hitsOut});
      }, deferred.reject);
      return deferred.promise;
    };

    return {
      "ELsearch": search,
      "dictionary": function () {
        var deferred = $q.defer();
        $http.get('./js/persons.json').success(function (response) {
          //console.log(response);
          deferred.resolve(response);
        });
        return deferred.promise;
      }
    };
  }]
);
