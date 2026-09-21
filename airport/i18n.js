
(function(){
  const LANGS=['vi','en','ko','ru','zh'];
  let lang='vi';
  try{lang=localStorage.getItem('jotrip_airport_lang')||'vi'}catch(_){}
  if(!LANGS.includes(lang))lang='vi';
  window.JT_I18N_ACTIVE=true;

  const D={
    vi:{
      today:'Hôm nay tại Phú Quốc',heroSub:'3 giây để biết sân bay đang ra sao.',total:'Tổng chuyến',arrivals:'Chuyến đến',departures:'Chuyến đi',intlArrivals:'Quốc tế đến',
      flightBoard:'Chuyến bay hôm nay',search:'Tìm chuyến',arrival:'Chuyến đến',departure:'Chuyến đi',all:'Tất cả',next3:'3 giờ tới',international:'Quốc tế',domestic:'Nội địa',changed:'Có thay đổi',showMore:'Xem thêm',
      searchPh:'Tìm số chuyến, hãng hoặc nơi đi/đến: VJ339, Hà Nội, Da Nang...',opsWatch:'Operation Watch',quickSubtitle:'Thông báo nhanh',scheduleWord:'lịch',nextArrivals:'Next Arrivals',dataHealth:'Data Health',
      live:'LIVE',history:'HISTORY',analytics:'ANALYTICS',flights:'Flights',refresh:'Refresh',
      yesterday:'HÔM QUA',todayShort:'HÔM NAY',tomorrow:'NGÀY MAI',yesterdayAt:'Hôm qua tại Phú Quốc',tomorrowAt:'Ngày mai tại Phú Quốc',flightsYesterday:'Chuyến bay hôm qua',flightsTomorrow:'Chuyến bay ngày mai',board:'BẢNG',boardYesterday:'BẢNG HÔM QUA',boardTomorrow:'BẢNG NGÀY MAI',boardUpdated:'Bảng {date} · lấy lúc {time}',
      healthPillGood:'GOOD · dữ liệu đang mới',healthPillWatch:'WATCH · dữ liệu chậm',healthPillStale:'STALE · dữ liệu cũ',sourceLive:'Dữ liệu chuyến bay · tự động làm mới',dataSync:'Đang đồng bộ dữ liệu...',healthCheckingDesc:'Đang kiểm tra luồng JoTrip Live và độ mới của dữ liệu.',
      fidsTitle:'Bảng thông tin chuyến bay',fidsDesc:'Giờ bay, dự kiến - thực tế, trạng thái, cửa ra máy bay, quầy check-in và băng hành lý.',
      sched:'LỊCH',estActual:'DỰ KIẾN / THỰC TẾ',flight:'CHUYẾN',route:'HÀNH TRÌNH',status:'TRẠNG THÁI',gate:'CỬA',counterBelt:'QUẦY CHECK-IN / BĂNG HÀNH LÝ',change:'THAY ĐỔI',
      counter:'QUẦY CHECK-IN',belt:'BĂNG HÀNH LÝ',arr:'ĐẾN',dep:'ĐI',intl:'QUỐC TẾ',dom:'NỘI ĐỊA',actual:'THỰC TẾ',est:'DỰ KIẾN',schedShort:'LỊCH',changedNow:'ĐÃ ĐỔI',
      stable:'FIDS đang ổn định',changesActive:'{n} thay đổi đang hiệu lực',noFidsChanges:'Chưa ghi nhận đổi cửa, đổi quầy hoặc đổi băng chuyền đang hiệu lực.',noFidsFlights:'Chưa có chuyến sắp tới trong dữ liệu FIDS.',
      sourceAirport:'Cập nhật theo dữ liệu sân bay',sourceAt:'Nguồn {time}',onTime:'Đúng giờ',checkinOpen:'Đang check-in',checkinClosed:'Check-in đã đóng',checkinSoon:'Sắp mở check-in',checkinFrom:'Check-in từ {time}',gateClosed:'Cửa ra máy bay đã đóng',ferryFlight:'Chuyến bay ferry',
      boarding:'Đang lên máy bay',arrived:'Đã hạ cánh',departed:'Đã cất cánh',cancelled:'Hủy',flyingToPqc:'Đang bay đến Phú Quốc',waitArrival:'Chờ giờ hạ cánh',waitDeparture:'Chờ giờ cất cánh',
      early:'Dự kiến sớm {n} phút',late:'Trễ {n} phút',lateMin:'Trễ ≥ {n} phút',earlyBy:'Sớm {n} phút',lateBy:'Trễ {n} phút',
      changeGate:'CỬA: {from} → {to}',changedFrom:'Trước: {from}',changeCounter:'QUẦY: {from} → {to}',changeBelt:'BĂNG: {from} → {to}',previousFrom:'Trước: {from}',watchChangeGate:'Cửa hiện tại {to} · trước {from}',watchChangeCounter:'Quầy check-in hiện tại {to} · trước {from}',watchChangeBelt:'Băng hành lý hiện tại {to} · trước {from}',
      watchDelayed:'Trễ',watchCancelled:'Hủy',watchEarly:'Sớm',watchClear:'Không có chuyến trễ, hủy hoặc sớm đáng kể hôm nay.',estimatedWord:'dự kiến',quickClear:'Chưa có thông báo cần chú ý ngay lúc này.',quickDataOld:'Dữ liệu đang cũ',quickDataOldBody:'Luồng live đang chậm. Hãy kiểm tra thời gian cập nhật trước khi dùng thông tin.',minutesAgo:'{n} phút',noEstimate:'Chưa có giờ dự kiến',estimatedTime:'Dự kiến {time}',toPqc:'Đến PQC',fromPqc:'Rời PQC',pctArrivals:'{pct} chuyến đến',pctDepartures:'{pct} chuyến đi',flightUnit:'chuyến',unknownAirline:'Chưa rõ hãng',delayMinimum:'Trễ ít nhất {n} phút tại thời điểm cập nhật',delayReported:'Đã báo trễ, chưa xác định số phút',airportNotPublished:'Sân bay chưa công bố',notApplicable:'Không áp dụng',airlinePerformanceKicker:'HIỆU SUẤT HÃNG BAY',arrivalsKicker:'CHUYẾN ĐẾN',departuresKicker:'CHUYẾN ĐI',onTimeShort:"ĐÚNG GIỜ ≤15'",otpNote:'OTP15 theo ngưỡng 15 phút, chỉ tính chuyến đã thực hiện.',fidsSync:'Đang đồng bộ',fidsSyncData:'Đang đồng bộ FIDS...',fallbackError:'Luồng live tạm gián đoạn - đang dùng bản lưu JoTrip AutoSync gần nhất.',loadError:'Không đọc được dữ liệu chuyến bay lúc này. Trang sẽ không dùng dữ liệu cũ như dữ liệu live.',healthLostTitle:'MẤT DỮ LIỆU',healthLostDesc:'Không thể tải nguồn live hoặc bản lưu dự phòng.',healthQaFailTitle:'QA FAILED',healthQaFailDesc:'Luồng thu thập hoặc chuẩn hóa chưa đạt. Không nên dùng số liệu để điều hành.',
      market:'Thị trường',scheduleCompare:'So với lịch',checkinCounter:'Quầy làm thủ tục',checkinTime:'Giờ mở check-in',boardingGate:'Cửa ra máy bay',baggageBelt:'Băng chuyền hành lý',parking:'Vị trí đỗ',source:'Nguồn',trackFlight:'Theo dõi chuyến bay',openFr24:'Tìm LIVE trên FR24 ↗',viewDetail:'Xem chi tiết',
      scheduledAt:'Theo lịch · {time}',actualAt:'Thực tế · {time}',estimatedAt:'Dự kiến · {time}',rawStatus:'Trạng thái gốc:',statusSource:'Trạng thái theo dữ liệu sân bay.',actualDesc:'Giờ thực tế đã được ghi nhận trong dữ liệu chuyến bay.',estimateDesc:'Giờ cập nhật theo dữ liệu chuyến bay.',
      noEstimateDesc:'Nguồn hiện tại chỉ báo trễ, chưa có giờ dự kiến nên JoTrip không tự đoán giờ.',noDelay:'Đúng giờ / chưa ghi nhận lệch lịch',unknown:'CHƯA RÕ',
      updated:'Cập nhật {time} · {age} phút trước · {source} · tự làm mới 1 phút',opsNormal:'OPERATIONS NORMAL',opsWatchCount:'WATCH · {n} CẢNH BÁO',dataStale:'DATA STALE',
      healthGoodTitle:'GOOD · dữ liệu đang mới',healthGoodDesc:'JoTrip Live đang cập nhật tự động, có cache ngắn để giữ ổn định.',healthWatchTitle:'WATCH · dữ liệu chậm cập nhật',healthWatchDesc:'Dữ liệu đang có độ trễ cao hơn bình thường. Trang sẽ tự kiểm tra lại mỗi phút.',
      healthStaleTitle:'STALE · không còn là dữ liệu live',healthStaleDesc:'Dữ liệu đã quá 15 phút. Không nên xem đây là trạng thái tức thời của sân bay.',healthFallbackTitle:'FALLBACK · đang dùng AutoSync',healthFallbackDesc:'Luồng live tạm không phản hồi. Giao diện đã chuyển sang bản lưu gần nhất.',
      analyticsTitle:'Cơ cấu chuyến bay',currentData:'Dữ liệu hiện tại',routeDistribution:'Tất cả điểm đi / đến',timeDistribution:'Phân bố theo khung giờ',flightStatus:'Flight Status',dataAge:'Data age',analyticsExplorerTitle:'Phân tích chuyến bay',analyticsExplorerDesc:'Chọn khoảng thời gian và góc phân tích.',analyticsLast7:'7 ngày gần nhất',analyticsLast30:'30 ngày gần nhất',analyticsLast7Short:'7 ngày',analyticsLast30Short:'30 ngày',analyticsCustom:'Tùy chọn',analyticsAnalysis:'Phân tích',analyticsOverview:'Tổng quan',analyticsRoutes:'Tuyến bay',analyticsTime:'Khung giờ',analyticsMarket:'Thị trường',analyticsAirlines:'Hãng bay',analyticsOtp:'Đúng giờ OTP15',direction:'Chiều bay',fromDate:'Từ ngày',toDate:'Đến ngày',apply:'Áp dụng',allAirlines:'Tất cả hãng',analyticsAirlinesCount:'Hãng bay',analyticsAirlineVolume:'Số chuyến theo hãng bay',analyticsMarketMix:'Cơ cấu thị trường',analyticsLoading:'Đang tải dữ liệu phân tích...',analyticsLoadingShort:'Đang tải...',analyticsDataLabel:'{period} · {n} chuyến',analyticsNoData:'Chưa có dữ liệu phù hợp.',analyticsNoDataRange:'Không có dữ liệu trong khoảng đã chọn.',analyticsLoadError:'Không tải được dữ liệu phân tích lúc này.',notEnoughActual:'Chưa đủ chuyến có giờ thực tế để tính tỷ lệ đúng giờ.',analyticsDelay:'Độ trễ',analyticsChanges:'Thay đổi vận hành',analyticsEstimate:'Dự kiến vs thực tế',otp15Label:'OTP15',delayOver30:'Trễ >30 phút',delayOver60:'Trễ >60 phút',medianDelay:'Median lệch giờ',p90Delay:'P90 trễ',analyticsGroup:'Nhóm',delayByRoute:'Độ trễ theo tuyến',delayByTime:'Độ trễ theo khung giờ',delayByAirline:'Độ trễ theo hãng',affectedFlights:'Chuyến có thay đổi',gateChanges:'Đổi cửa',checkinChanges:'Đổi quầy',beltChanges:'Đổi băng',timeChanges:'Đổi giờ',changesPerFlight:'Thay đổi/chuyến',changesByAirline:'Thay đổi theo hãng',changesByRoute:'Thay đổi theo tuyến',estimateSamples:'Chuyến có đủ dữ liệu',estimateMae:'Sai số TB',estimateMedian:'Median sai số',estimateWithin5:'Trong ±5 phút',estimateWithin15:'Trong ±15 phút',estimateRevisions:'Lần sửa dự kiến',estimateByAirline:'Sai số dự kiến theo hãng',dailyTrend:'Xu hướng theo ngày',analysisInsights:'NHẬN ĐỊNH',analysisWhatMatters:'Điểm đáng chú ý',insightDirectionOtp:'{side} có OTP15 thấp hơn {diff} điểm %.',insightRouteDelay:'{route} có {late}/{total} chuyến trễ >15 phút, OTP15 {otp}%.',insightTimeDelay:'Khung {time} có {late} chuyến trễ >15 phút, OTP15 {otp}%.',insightChanges:'{flights} chuyến có thay đổi vận hành: {gate} cửa, {checkin} quầy, {belt} băng chuyền, {time} giờ.',insightEstimate:'Sai số trung bình của giờ dự kiến cuối cùng so với thực tế là {minutes} phút trên {n} chuyến.',insightInsufficient:'Chưa đủ dữ liệu thực tế để rút ra nhận định đáng tin cậy cho bộ lọc này.',routePunctuality:'Đúng giờ theo tuyến',timePunctuality:'Đúng giờ theo khung giờ',airlinePunctuality:'Đúng giờ theo hãng',
      airlinePerfTitle:'Đúng giờ / trễ theo hãng',allAirlinesDay:'Tất cả hãng trong ngày',arrivalsPqc:'Đến Phú Quốc',departuresPqc:'Rời Phú Quốc',airlineCol:'Hãng',totalCol:'Tổng chuyến',completedCol:'Đã thực hiện',onTimeCol:'Đúng giờ',late15Col:'Trễ >15\'',avgDelayCol:'Trễ TB',noFlightsDay:'Chưa có chuyến trong ngày.',noCompleted:'Chưa có chuyến đã thực hiện',onTimeSample:'{on}/{total} chuyến đúng giờ',minuteUnit:'phút',
      noFlights:'Không có chuyến phù hợp bộ lọc hiện tại.',noNextArrivals:'Chưa có chuyến đến tiếp theo trong dữ liệu.',ssArrivals:'CHUYẾN ĐẾN',ssDepartures:'CHUYẾN ĐI',ssNoFlights:'Không có chuyến',ssCancelled:'Hủy chuyến',ssArrived:'Đã hạ cánh',ssDelayed:'Trễ / đổi giờ',ssEnRoute:'Đang bay đến Phú Quốc',ssAwaitArr:'Chờ xác nhận hạ cánh',ssSchedArr:'Chưa hạ cánh · theo lịch',ssDeparted:'Đã cất cánh',ssServing:'Đang phục vụ tại sân bay',ssCheckinSoon:'Sắp làm thủ tục',ssAwaitDep:'Chờ xác nhận cất cánh',ssSchedDep:'Theo lịch · chưa cất cánh'
    },
    en:{
      today:'Today at Phu Quoc',heroSub:'Understand the airport in 3 seconds.',total:'Total flights',arrivals:'Arrivals',departures:'Departures',intlArrivals:'International arrivals',
      flightBoard:'Today’s flights',search:'Find flight',arrival:'Arrivals',departure:'Departures',all:'All',next3:'Next 3 hours',international:'International',domestic:'Domestic',changed:'Changed',showMore:'Show more',
      searchPh:'Search flight, airline or city: VJ339, Hanoi, Da Nang...',opsWatch:'Operation Watch',quickSubtitle:'Quick alerts',scheduleWord:'sched',nextArrivals:'Next Arrivals',dataHealth:'Data Health',
      live:'LIVE',history:'HISTORY',analytics:'ANALYTICS',flights:'Flights',refresh:'Refresh',
      yesterday:'YESTERDAY',todayShort:'TODAY',tomorrow:'TOMORROW',yesterdayAt:'Yesterday at Phu Quoc',tomorrowAt:'Tomorrow at Phu Quoc',flightsYesterday:'Yesterday’s flights',flightsTomorrow:'Tomorrow’s flights',board:'BOARD',boardYesterday:'YESTERDAY BOARD',boardTomorrow:'TOMORROW BOARD',boardUpdated:'Board {date} · fetched at {time}',
      healthPillGood:'GOOD · data fresh',healthPillWatch:'WATCH · data delayed',healthPillStale:'STALE · data old',sourceLive:'JoTrip Live · Auto refresh',dataSync:'Syncing data...',healthCheckingDesc:'Checking the JoTrip Live feed and data freshness.',
      fidsTitle:'Flight information display',fidsDesc:'Schedule, estimate/actual, status, boarding gate, check-in counter and baggage belt.',
      sched:'SCHED',estActual:'EST / ACTUAL',flight:'FLIGHT',route:'ROUTE',status:'STATUS',gate:'GATE',counterBelt:'CHECK-IN / BAGGAGE',change:'CHANGE',
      counter:'CHECK-IN COUNTER',belt:'BAGGAGE BELT',arr:'ARR',dep:'DEP',intl:'INTL',dom:'DOM',actual:'ACTUAL',est:'EST',schedShort:'SCHED',changedNow:'CHANGED',
      stable:'FIDS stable',changesActive:'{n} active changes',noFidsChanges:'No active gate, check-in counter or baggage belt changes.',noFidsFlights:'No upcoming flights in FIDS data.',
      sourceAirport:'Updated from airport data',sourceAt:'Source {time}',onTime:'On time',checkinOpen:'Check-in open',checkinClosed:'Check-in closed',checkinSoon:'Check-in opening soon',checkinFrom:'Check-in from {time}',gateClosed:'Boarding gate closed',ferryFlight:'Ferry flight',
      boarding:'Boarding',arrived:'Arrived',departed:'Departed',cancelled:'Cancelled',flyingToPqc:'En route to Phu Quoc',waitArrival:'Awaiting arrival time',waitDeparture:'Awaiting departure time',
      early:'Estimated {n} min early',late:'Delayed {n} min',lateMin:'Delayed ≥ {n} min',earlyBy:'{n} min early',lateBy:'{n} min late',
      changeGate:'GATE: {from} → {to}',changedFrom:'Previous: {from}',changeCounter:'CHECK-IN: {from} → {to}',changeBelt:'BELT: {from} → {to}',previousFrom:'Previous: {from}',watchChangeGate:'Current gate {to} · previous {from}',watchChangeCounter:'Current check-in counter {to} · previous {from}',watchChangeBelt:'Current baggage belt {to} · previous {from}',
      watchDelayed:'Delayed',watchCancelled:'Cancelled',watchEarly:'Early',watchClear:'No significantly delayed, cancelled or early flights today.',estimatedWord:'estimated',quickClear:'No immediate alerts right now.',quickDataOld:'Data is stale',quickDataOldBody:'The live feed is delayed. Check the update time before relying on this information.',minutesAgo:'{n} min',noEstimate:'No estimated time yet',estimatedTime:'Estimated {time}',toPqc:'Arrive PQC',fromPqc:'Depart PQC',pctArrivals:'{pct} arrivals',pctDepartures:'{pct} departures',flightUnit:'flights',unknownAirline:'Unknown airline',delayMinimum:'Delayed at least {n} min at update time',delayReported:'Delay reported, minutes not yet available',airportNotPublished:'Airport has not published a time',notApplicable:'Not applicable',airlinePerformanceKicker:'AIRLINE PERFORMANCE',arrivalsKicker:'ARRIVALS',departuresKicker:'DEPARTURES',onTimeShort:"ON TIME ≤15'",otpNote:'OTP15 uses a 15-minute threshold and scores completed flights only.',fidsSync:'Syncing',fidsSyncData:'Syncing FIDS...',fallbackError:'The live feed is temporarily unavailable - using the latest JoTrip AutoSync snapshot.',loadError:'Flight data is unavailable right now. Old data will not be shown as live.',healthLostTitle:'DATA UNAVAILABLE',healthLostDesc:'Unable to load the live source or fallback snapshot.',healthQaFailTitle:'QA FAILED',healthQaFailDesc:'Collection or normalization did not pass QA. Do not use this data for operations.',
      market:'Market',scheduleCompare:'Vs schedule',checkinCounter:'Check-in counter',checkinTime:'Check-in opens',boardingGate:'Boarding gate',baggageBelt:'Baggage belt',parking:'Parking bay',source:'Source',trackFlight:'Flight tracking',openFr24:'Find LIVE on FR24 ↗',viewDetail:'View details',
      scheduledAt:'Scheduled · {time}',actualAt:'Actual · {time}',estimatedAt:'Estimated · {time}',rawStatus:'Original airport status:',statusSource:'Status from airport data.',actualDesc:'Actual time recorded in flight data.',estimateDesc:'Updated time from flight data.',
      noEstimateDesc:'The source reports a delay but has not published an estimated time. JoTrip does not guess it.',noDelay:'On time / no schedule deviation',unknown:'UNKNOWN',
      updated:'Updated {time} · {age} min ago · {source} · refreshes every minute',opsNormal:'OPERATIONS NORMAL',opsWatchCount:'WATCH · {n} ALERTS',dataStale:'DATA STALE',
      healthGoodTitle:'GOOD · DATA FRESH',healthGoodDesc:'JoTrip Live is updating automatically with a short stability cache.',healthWatchTitle:'WATCH · DATA DELAYED',healthWatchDesc:'Data is slower than usual. The page checks again every minute.',
      healthStaleTitle:'STALE · DATA OLD',healthStaleDesc:'Data is over 15 minutes old and should not be treated as real-time.',healthFallbackTitle:'FALLBACK · AUTOSYNC',healthFallbackDesc:'The live feed is temporarily unavailable. The page is using the latest stored snapshot.',
      analyticsTitle:'Flight mix',currentData:'Current data',routeDistribution:'All origins / destinations',timeDistribution:'Distribution by time',flightStatus:'Flight Status',dataAge:'Data age',analyticsExplorerTitle:'Flight analytics',analyticsExplorerDesc:'Choose a time period and analysis view.',analyticsLast7:'Last 7 days',analyticsLast30:'Last 30 days',analyticsLast7Short:'7 days',analyticsLast30Short:'30 days',analyticsCustom:'Custom',analyticsAnalysis:'Analysis',analyticsOverview:'Overview',analyticsRoutes:'Routes',analyticsTime:'Time bands',analyticsMarket:'Market',analyticsAirlines:'Airlines',analyticsOtp:'On-time OTP15',direction:'Direction',fromDate:'From',toDate:'To',apply:'Apply',allAirlines:'All airlines',analyticsAirlinesCount:'Airlines',analyticsAirlineVolume:'Flights by airline',analyticsMarketMix:'Market mix',analyticsLoading:'Loading analytics data...',analyticsLoadingShort:'Loading...',analyticsDataLabel:'{period} · {n} flights',analyticsNoData:'No matching data.',analyticsNoDataRange:'No data is available for the selected period.',analyticsLoadError:'Analytics data is unavailable right now.',notEnoughActual:'Not enough flights with actual times to calculate on-time performance.',analyticsDelay:'Delay analysis',analyticsChanges:'Operational changes',analyticsEstimate:'Estimate vs actual',otp15Label:'OTP15',delayOver30:'Delayed >30 min',delayOver60:'Delayed >60 min',medianDelay:'Median deviation',p90Delay:'P90 delay',analyticsGroup:'Group',delayByRoute:'Delay by route',delayByTime:'Delay by time band',delayByAirline:'Delay by airline',affectedFlights:'Flights with changes',gateChanges:'Gate changes',checkinChanges:'Check-in changes',beltChanges:'Baggage belt changes',timeChanges:'Time changes',changesPerFlight:'Changes/flight',changesByAirline:'Changes by airline',changesByRoute:'Changes by route',estimateSamples:'Flights with full data',estimateMae:'Mean absolute error',estimateMedian:'Median error',estimateWithin5:'Within ±5 min',estimateWithin15:'Within ±15 min',estimateRevisions:'Estimate revisions',estimateByAirline:'Estimate error by airline',dailyTrend:'Daily trend',analysisInsights:'INSIGHTS',analysisWhatMatters:'What stands out',insightDirectionOtp:'{side} has OTP15 lower by {diff} percentage points.',insightRouteDelay:'{route} has {late}/{total} flights delayed >15 min, OTP15 {otp}%.',insightTimeDelay:'{time} has {late} flights delayed >15 min, OTP15 {otp}%.',insightChanges:'{flights} flights had operational changes: {gate} gate, {checkin} check-in, {belt} baggage belt, {time} time changes.',insightEstimate:'The final estimated time differs from actual by an average of {minutes} min across {n} flights.',insightInsufficient:'Not enough actual data to produce a reliable insight for this filter.',routePunctuality:'On-time performance by route',timePunctuality:'On-time performance by time band',airlinePunctuality:'On-time performance by airline',
      airlinePerfTitle:'On-time / delay by airline',allAirlinesDay:'All airlines today',arrivalsPqc:'Arrivals to Phu Quoc',departuresPqc:'Departures from Phu Quoc',airlineCol:'Airline',totalCol:'Total',completedCol:'Completed',onTimeCol:'On time',late15Col:'Delayed >15 min',avgDelayCol:'Avg delay',noFlightsDay:'No flights today.',noCompleted:'No completed flights yet',onTimeSample:'{on}/{total} on time',minuteUnit:'min',
      noFlights:'No flights match the current filters.',noNextArrivals:'No upcoming arrivals in the current data.',ssArrivals:'ARRIVALS',ssDepartures:'DEPARTURES',ssNoFlights:'No flights',ssCancelled:'Cancelled',ssArrived:'Arrived',ssDelayed:'Delayed / rescheduled',ssEnRoute:'En route to Phu Quoc',ssAwaitArr:'Awaiting arrival confirmation',ssSchedArr:'Scheduled · not yet arrived',ssDeparted:'Departed',ssServing:'Being served at airport',ssCheckinSoon:'Check-in opening soon',ssAwaitDep:'Awaiting departure confirmation',ssSchedDep:'Scheduled · not yet departed'
    },
    ko:{
      today:'오늘의 푸꾸옥 공항',heroSub:'3초 만에 공항 상황을 확인하세요.',total:'전체 항공편',arrivals:'도착',departures:'출발',intlArrivals:'국제선 도착',
      flightBoard:'오늘의 항공편',search:'항공편 찾기',arrival:'도착',departure:'출발',all:'전체',next3:'향후 3시간',international:'국제선',domestic:'국내선',changed:'변경 있음',showMore:'더 보기',
      searchPh:'편명, 항공사 또는 도시 검색: VJ339, Hanoi, Da Nang...',opsWatch:'Operation Watch',quickSubtitle:'빠른 알림',scheduleWord:'예정',nextArrivals:'다음 도착편',dataHealth:'데이터 상태',
      live:'실시간',history:'이력',analytics:'분석',flights:'항공편',refresh:'새로고침',
      yesterday:'어제',todayShort:'오늘',tomorrow:'내일',yesterdayAt:'어제 푸꾸옥 공항',tomorrowAt:'내일 푸꾸옥 공항',flightsYesterday:'어제 항공편',flightsTomorrow:'내일 항공편',board:'운항표',boardYesterday:'어제 운항표',boardTomorrow:'내일 운항표',boardUpdated:'운항표 {date} · {time} 기준',
      healthPillGood:'정상 · 최신 데이터',healthPillWatch:'주의 · 데이터 지연',healthPillStale:'오래된 데이터',sourceLive:'JoTrip Live · 자동 새로고침',dataSync:'데이터 동기화 중...',healthCheckingDesc:'JoTrip Live 데이터와 최신 상태를 확인하고 있습니다.',
      fidsTitle:'항공편 정보 안내',fidsDesc:'예정·예상/실제 시간, 상태, 탑승구, 체크인 카운터 및 수하물 벨트.',
      sched:'예정',estActual:'예상 / 실제',flight:'편명',route:'노선',status:'상태',gate:'게이트',counterBelt:'체크인 / 수하물 벨트',change:'변경',
      counter:'체크인 카운터',belt:'수하물 벨트',arr:'도착',dep:'출발',intl:'국제선',dom:'국내선',actual:'실제',est:'예상',schedShort:'예정',changedNow:'변경됨',
      stable:'FIDS 정상',changesActive:'변경 {n}건 적용 중',noFidsChanges:'현재 게이트, 체크인 카운터 또는 수하물 벨트 변경이 없습니다.',noFidsFlights:'FIDS에 예정 항공편이 없습니다.',
      sourceAirport:'공항 데이터 기준',sourceAt:'데이터 {time}',onTime:'정시',checkinOpen:'체크인 중',checkinClosed:'체크인 마감',checkinSoon:'체크인 곧 시작',checkinFrom:'{time}부터 체크인',gateClosed:'탑승구 마감',ferryFlight:'페리 비행',
      boarding:'탑승 중',arrived:'도착 완료',departed:'출발 완료',cancelled:'취소',flyingToPqc:'푸꾸옥으로 운항 중',waitArrival:'도착 시간 대기',waitDeparture:'출발 시간 대기',
      early:'예상 {n}분 조기',late:'{n}분 지연',lateMin:'최소 {n}분 지연',earlyBy:'{n}분 조기',lateBy:'{n}분 지연',
      changeGate:'게이트: {from} → {to}',changedFrom:'이전: {from}',changeCounter:'체크인: {from} → {to}',changeBelt:'벨트: {from} → {to}',previousFrom:'이전: {from}',watchChangeGate:'현재 게이트 {to} · 이전 {from}',watchChangeCounter:'현재 체크인 카운터 {to} · 이전 {from}',watchChangeBelt:'현재 수하물 벨트 {to} · 이전 {from}',
      watchDelayed:'지연',watchCancelled:'취소',watchEarly:'조기',watchClear:'오늘 큰 지연, 취소 또는 조기 운항 항공편이 없습니다.',estimatedWord:'예상',quickClear:'현재 즉시 확인할 알림이 없습니다.',quickDataOld:'데이터가 오래되었습니다',quickDataOldBody:'실시간 데이터가 지연되고 있습니다. 정보 사용 전 업데이트 시간을 확인하세요.',minutesAgo:'{n}분',noEstimate:'예상 시간이 아직 없습니다',estimatedTime:'예상 {time}',toPqc:'PQC 도착',fromPqc:'PQC 출발',pctArrivals:'도착 {pct}',pctDepartures:'출발 {pct}',flightUnit:'편',unknownAirline:'항공사 미확인',delayMinimum:'업데이트 시점 기준 최소 {n}분 지연',delayReported:'지연 보고됨 · 지연 시간 미확인',airportNotPublished:'공항 예상 시간 미공개',notApplicable:'해당 없음',airlinePerformanceKicker:'항공사 운항 성과',arrivalsKicker:'도착',departuresKicker:'출발',onTimeShort:"정시 ≤15분",otpNote:'OTP15는 15분 기준이며 운항 완료 항공편만 계산합니다.',fidsSync:'동기화 중',fidsSyncData:'FIDS 동기화 중...',fallbackError:'실시간 데이터가 일시적으로 중단되어 최신 JoTrip AutoSync 데이터를 사용합니다.',loadError:'현재 항공편 데이터를 불러올 수 없습니다. 오래된 데이터를 실시간으로 표시하지 않습니다.',healthLostTitle:'데이터 없음',healthLostDesc:'실시간 데이터와 예비 데이터를 불러올 수 없습니다.',healthQaFailTitle:'QA 실패',healthQaFailDesc:'수집 또는 정규화가 QA를 통과하지 못했습니다. 운영 판단에 사용하지 마세요.',
      market:'구분',scheduleCompare:'예정 대비',checkinCounter:'체크인 카운터',checkinTime:'체크인 시작',boardingGate:'탑승 게이트',baggageBelt:'수하물 벨트',parking:'주기장',source:'출처',trackFlight:'항공편 추적',openFr24:'FR24 검색 ↗',
      scheduledAt:'예정 · {time}',actualAt:'실제 · {time}',estimatedAt:'예상 · {time}',rawStatus:'공항 원문 상태:',statusSource:'공항 데이터 기준 상태입니다.',actualDesc:'실제 시간이 항공편 데이터에 기록되었습니다.',estimateDesc:'항공편 데이터의 업데이트 시간입니다.',
      noEstimateDesc:'지연은 표시되었지만 예상 시간은 아직 공개되지 않았습니다. JoTrip은 임의로 추정하지 않습니다.',noDelay:'정시 / 시간 변동 없음',unknown:'미확인',
      updated:'업데이트 {time} · {age}분 전 · {source} · 1분마다 갱신',opsNormal:'운항 정상',opsWatchCount:'WATCH · {n}건',dataStale:'데이터 지연',
      healthGoodTitle:'정상 · 최신 데이터',healthGoodDesc:'JoTrip Live가 자동 업데이트 중이며 안정성을 위한 짧은 캐시를 사용합니다.',healthWatchTitle:'주의 · 데이터 지연',healthWatchDesc:'데이터가 평소보다 늦습니다. 페이지는 매분 다시 확인합니다.',
      healthStaleTitle:'오래된 데이터',healthStaleDesc:'데이터가 15분 이상 지나 실시간 상태로 보기 어렵습니다.',healthFallbackTitle:'대체 데이터 · AUTOSYNC',healthFallbackDesc:'실시간 피드가 일시적으로 응답하지 않아 최근 저장 데이터를 사용합니다.',
      analyticsTitle:'항공편 구성',currentData:'현재 데이터',routeDistribution:'전체 출발지 / 도착지',timeDistribution:'시간대별 분포',flightStatus:'항공편 상태',dataAge:'데이터 경과',analyticsExplorerTitle:'항공편 분석',analyticsExplorerDesc:'기간과 분석 항목을 선택하세요.',analyticsLast7:'최근 7일',analyticsLast30:'최근 30일',analyticsLast7Short:'7일',analyticsLast30Short:'30일',analyticsCustom:'기간 선택',analyticsAnalysis:'분석',analyticsOverview:'개요',analyticsRoutes:'노선',analyticsTime:'시간대',analyticsMarket:'시장',analyticsAirlines:'항공사',analyticsOtp:'정시 OTP15',direction:'방향',fromDate:'시작일',toDate:'종료일',apply:'적용',allAirlines:'전체 항공사',analyticsAirlinesCount:'항공사',analyticsAirlineVolume:'항공사별 운항편',analyticsMarketMix:'시장 구성',analyticsLoading:'분석 데이터를 불러오는 중...',analyticsLoadingShort:'불러오는 중...',analyticsDataLabel:'{period} · {n}편',analyticsNoData:'조건에 맞는 데이터가 없습니다.',analyticsNoDataRange:'선택한 기간에 데이터가 없습니다.',analyticsLoadError:'현재 분석 데이터를 불러올 수 없습니다.',notEnoughActual:'정시율을 계산할 실제 시간 데이터가 충분하지 않습니다.',analyticsDelay:'지연 분석',analyticsChanges:'운항 변경',analyticsEstimate:'예상 vs 실제',otp15Label:'OTP15',delayOver30:'30분 초과 지연',delayOver60:'60분 초과 지연',medianDelay:'중앙값 편차',p90Delay:'P90 지연',analyticsGroup:'그룹',delayByRoute:'노선별 지연',delayByTime:'시간대별 지연',delayByAirline:'항공사별 지연',affectedFlights:'변경 항공편',gateChanges:'게이트 변경',checkinChanges:'체크인 변경',beltChanges:'수하물 벨트 변경',timeChanges:'시간 변경',changesPerFlight:'항공편당 변경',changesByAirline:'항공사별 변경',changesByRoute:'노선별 변경',estimateSamples:'충분한 데이터가 있는 항공편',estimateMae:'평균 절대 오차',estimateMedian:'중앙값 오차',estimateWithin5:'±5분 이내',estimateWithin15:'±15분 이내',estimateRevisions:'예상 시간 수정 횟수',estimateByAirline:'항공사별 예상 오차',dailyTrend:'일별 추세',analysisInsights:'분석',analysisWhatMatters:'주요 포인트',insightDirectionOtp:'{side}의 OTP15가 {diff}%p 더 낮습니다.',insightRouteDelay:'{route}는 {late}/{total}편이 15분 초과 지연, OTP15 {otp}%입니다.',insightTimeDelay:'{time} 시간대에 15분 초과 지연 {late}편, OTP15 {otp}%입니다.',insightChanges:'{flights}편에 운항 변경이 있었습니다: 게이트 {gate}, 체크인 {checkin}, 수하물 벨트 {belt}, 시간 {time}.',insightEstimate:'최종 예상 시간의 실제 대비 평균 오차는 {n}편 기준 {minutes}분입니다.',insightInsufficient:'이 필터에서는 신뢰할 만한 분석을 만들 실제 데이터가 충분하지 않습니다.',routePunctuality:'노선별 정시 성과',timePunctuality:'시간대별 정시 성과',airlinePunctuality:'항공사별 정시 성과',
      airlinePerfTitle:'항공사별 정시 / 지연',allAirlinesDay:'오늘 전체 항공사',arrivalsPqc:'푸꾸옥 도착',departuresPqc:'푸꾸옥 출발',airlineCol:'항공사',totalCol:'전체',completedCol:'운항 완료',onTimeCol:'정시',late15Col:'15분 초과 지연',avgDelayCol:'평균 지연',noFlightsDay:'오늘 항공편이 없습니다.',noCompleted:'완료된 항공편이 없습니다',onTimeSample:'{on}/{total} 정시',minuteUnit:'분',
      noFlights:'현재 필터에 맞는 항공편이 없습니다.',noNextArrivals:'다음 도착편 정보가 없습니다.',ssArrivals:'도착',ssDepartures:'출발',ssNoFlights:'항공편 없음',ssCancelled:'취소',ssArrived:'도착 완료',ssDelayed:'지연 / 시간 변경',ssEnRoute:'푸꾸옥으로 운항 중',ssAwaitArr:'도착 확인 대기',ssSchedArr:'예정 · 아직 도착 전',ssDeparted:'출발 완료',ssServing:'공항 서비스 중',ssCheckinSoon:'체크인 곧 시작',ssAwaitDep:'출발 확인 대기',ssSchedDep:'예정 · 아직 출발 전'
    },
    ru:{
      today:'Сегодня в аэропорту Фукуока',heroSub:'Ситуация в аэропорту за 3 секунды.',total:'Всего рейсов',arrivals:'Прибытия',departures:'Вылеты',intlArrivals:'Международные прибытия',
      flightBoard:'Рейсы сегодня',search:'Найти рейс',arrival:'Прибытия',departure:'Вылеты',all:'Все',next3:'Ближайшие 3 часа',international:'Международные',domestic:'Внутренние',changed:'Есть изменения',showMore:'Показать ещё',
      searchPh:'Поиск по рейсу, авиакомпании или городу: VJ339, Hanoi, Da Nang...',opsWatch:'Operation Watch',quickSubtitle:'Быстрые уведомления',scheduleWord:'расп.',nextArrivals:'Ближайшие прибытия',dataHealth:'Состояние данных',
      live:'LIVE',history:'ИСТОРИЯ',analytics:'АНАЛИТИКА',flights:'Рейсы',refresh:'Обновить',
      yesterday:'ВЧЕРА',todayShort:'СЕГОДНЯ',tomorrow:'ЗАВТРА',yesterdayAt:'Вчера в аэропорту Фукуока',tomorrowAt:'Завтра в аэропорту Фукуока',flightsYesterday:'Рейсы вчера',flightsTomorrow:'Рейсы завтра',board:'ТАБЛО',boardYesterday:'ТАБЛО ВЧЕРА',boardTomorrow:'ТАБЛО ЗАВТРА',boardUpdated:'Табло {date} · данные на {time}',
      healthPillGood:'GOOD · ДАННЫЕ СВЕЖИЕ',healthPillWatch:'WATCH · ЗАДЕРЖКА ДАННЫХ',healthPillStale:'STALE · ДАННЫЕ УСТАРЕЛИ',sourceLive:'JoTrip Live · Автообновление',dataSync:'Синхронизация данных...',healthCheckingDesc:'Проверяется поток JoTrip Live и актуальность данных.',
      fidsTitle:'Табло рейсов',fidsDesc:'Расписание, расчётное/фактическое время, статус, выход на посадку, стойка регистрации и багажная лента.',
      sched:'РАСП.',estActual:'РАСЧ. / ФАКТ.',flight:'РЕЙС',route:'МАРШРУТ',status:'СТАТУС',gate:'ВЫХОД',counterBelt:'РЕГИСТРАЦИЯ / БАГАЖ',change:'ИЗМЕНЕНИЕ',
      counter:'СТОЙКА РЕГИСТРАЦИИ',belt:'БАГАЖНАЯ ЛЕНТА',arr:'ПРИБ.',dep:'ВЫЛ.',intl:'МЕЖД.',dom:'ВНУТР.',actual:'ФАКТ',est:'РАСЧ',schedShort:'РАСП',changedNow:'ИЗМЕНЕНО',
      stable:'FIDS без изменений',changesActive:'Активных изменений: {n}',noFidsChanges:'Нет активных изменений выхода, стойки регистрации или багажной ленты.',noFidsFlights:'Нет ближайших рейсов в данных FIDS.',
      sourceAirport:'По данным аэропорта',sourceAt:'Источник {time}',onTime:'По расписанию',checkinOpen:'Регистрация открыта',checkinClosed:'Регистрация закрыта',checkinSoon:'Регистрация скоро откроется',checkinFrom:'Регистрация с {time}',gateClosed:'Выход на посадку закрыт',ferryFlight:'Перегонный рейс',
      boarding:'Посадка',arrived:'Прибыл',departed:'Вылетел',cancelled:'Отменён',flyingToPqc:'В пути на Фукуок',waitArrival:'Ожидается время прибытия',waitDeparture:'Ожидается время вылета',
      early:'Ожидается на {n} мин раньше',late:'Задержка {n} мин',lateMin:'Задержка ≥ {n} мин',earlyBy:'На {n} мин раньше',lateBy:'На {n} мин позже',
      changeGate:'ВЫХОД: {from} → {to}',changedFrom:'Было: {from}',changeCounter:'РЕГИСТРАЦИЯ: {from} → {to}',changeBelt:'ЛЕНТА: {from} → {to}',previousFrom:'Было: {from}',watchChangeGate:'Текущий выход {to} · ранее {from}',watchChangeCounter:'Текущая стойка регистрации {to} · ранее {from}',watchChangeBelt:'Текущая багажная лента {to} · ранее {from}',
      watchDelayed:'Задержано',watchCancelled:'Отменено',watchEarly:'Раньше',watchClear:'Сегодня нет значительных задержек, отмен или ранних вылетов.',estimatedWord:'расч.',quickClear:'Сейчас срочных уведомлений нет.',quickDataOld:'Данные устарели',quickDataOldBody:'Live-поток задерживается. Проверьте время обновления перед использованием информации.',minutesAgo:'{n} мин',noEstimate:'Расчётное время пока не опубликовано',estimatedTime:'Расчётное {time}',toPqc:'Прибытие PQC',fromPqc:'Вылет PQC',pctArrivals:'{pct} прибытий',pctDepartures:'{pct} вылетов',flightUnit:'рейсов',unknownAirline:'Авиакомпания не указана',delayMinimum:'Задержка не менее {n} мин на момент обновления',delayReported:'Задержка заявлена, точное число минут пока неизвестно',airportNotPublished:'Аэропорт ещё не опубликовал время',notApplicable:'Не применяется',airlinePerformanceKicker:'ПОКАЗАТЕЛИ АВИАКОМПАНИЙ',arrivalsKicker:'ПРИБЫТИЯ',departuresKicker:'ВЫЛЕТЫ',onTimeShort:"ВОВРЕМЯ ≤15 МИН",otpNote:'OTP15 использует порог 15 минут и учитывает только выполненные рейсы.',fidsSync:'Синхронизация',fidsSyncData:'Синхронизация FIDS...',fallbackError:'Live-поток временно недоступен - используется последний снимок JoTrip AutoSync.',loadError:'Данные рейсов сейчас недоступны. Старые данные не будут показаны как live.',healthLostTitle:'НЕТ ДАННЫХ',healthLostDesc:'Не удалось загрузить live-источник или резервный снимок.',healthQaFailTitle:'QA FAILED',healthQaFailDesc:'Сбор или нормализация не прошли QA. Не используйте эти данные для оперативных решений.',
      market:'Тип',scheduleCompare:'К расписанию',checkinCounter:'Стойка регистрации',checkinTime:'Начало регистрации',boardingGate:'Выход на посадку',baggageBelt:'Багажная лента',parking:'Место стоянки',source:'Источник',trackFlight:'Отслеживание рейса',openFr24:'Найти в FR24 ↗',
      scheduledAt:'По расписанию · {time}',actualAt:'Факт · {time}',estimatedAt:'Расчётное · {time}',rawStatus:'Исходный статус аэропорта:',statusSource:'Статус по данным аэропорта.',actualDesc:'Фактическое время записано в данных рейса.',estimateDesc:'Обновлённое время из данных рейса.',
      noEstimateDesc:'Источник сообщает о задержке, но расчётное время ещё не опубликовано. JoTrip не прогнозирует его самостоятельно.',noDelay:'По расписанию / отклонений нет',unknown:'НЕТ ДАННЫХ',
      updated:'Обновлено {time} · {age} мин назад · {source} · обновление каждую минуту',opsNormal:'ОПЕРАЦИИ В НОРМЕ',opsWatchCount:'WATCH · {n}',dataStale:'ДАННЫЕ УСТАРЕЛИ',
      healthGoodTitle:'GOOD · ДАННЫЕ СВЕЖИЕ',healthGoodDesc:'JoTrip Live обновляется автоматически с коротким кэшем для стабильности.',healthWatchTitle:'WATCH · ЗАДЕРЖКА ДАННЫХ',healthWatchDesc:'Данные поступают медленнее обычного. Страница проверяет их каждую минуту.',
      healthStaleTitle:'STALE · ДАННЫЕ УСТАРЕЛИ',healthStaleDesc:'Данным больше 15 минут, их нельзя считать оперативными.',healthFallbackTitle:'FALLBACK · AUTOSYNC',healthFallbackDesc:'Live-поток временно недоступен. Используется последний сохранённый снимок.',
      analyticsTitle:'Структура рейсов',currentData:'Текущие данные',routeDistribution:'Все пункты отправления / назначения',timeDistribution:'Распределение по времени',flightStatus:'Статусы рейсов',dataAge:'Возраст данных',analyticsExplorerTitle:'Аналитика рейсов',analyticsExplorerDesc:'Выберите период и тип анализа.',analyticsLast7:'Последние 7 дней',analyticsLast30:'Последние 30 дней',analyticsLast7Short:'7 дней',analyticsLast30Short:'30 дней',analyticsCustom:'Свой период',analyticsAnalysis:'Анализ',analyticsOverview:'Обзор',analyticsRoutes:'Маршруты',analyticsTime:'Время',analyticsMarket:'Рынок',analyticsAirlines:'Авиакомпании',analyticsOtp:'Пунктуальность OTP15',direction:'Направление',fromDate:'С даты',toDate:'По дату',apply:'Применить',allAirlines:'Все авиакомпании',analyticsAirlinesCount:'Авиакомпании',analyticsAirlineVolume:'Рейсы по авиакомпаниям',analyticsMarketMix:'Структура рынка',analyticsLoading:'Загрузка данных аналитики...',analyticsLoadingShort:'Загрузка...',analyticsDataLabel:'{period} · {n} рейсов',analyticsNoData:'Нет подходящих данных.',analyticsNoDataRange:'Нет данных за выбранный период.',analyticsLoadError:'Сейчас не удалось загрузить данные аналитики.',notEnoughActual:'Недостаточно рейсов с фактическим временем для расчёта пунктуальности.',analyticsDelay:'Анализ задержек',analyticsChanges:'Операционные изменения',analyticsEstimate:'Расчётное vs фактическое',otp15Label:'OTP15',delayOver30:'Задержка >30 мин',delayOver60:'Задержка >60 мин',medianDelay:'Медианное отклонение',p90Delay:'P90 задержки',analyticsGroup:'Группа',delayByRoute:'Задержки по маршрутам',delayByTime:'Задержки по времени',delayByAirline:'Задержки по авиакомпаниям',affectedFlights:'Рейсы с изменениями',gateChanges:'Смена выхода',checkinChanges:'Смена стойки',beltChanges:'Смена багажной ленты',timeChanges:'Изменения времени',changesPerFlight:'Изменений/рейс',changesByAirline:'Изменения по авиакомпаниям',changesByRoute:'Изменения по маршрутам',estimateSamples:'Рейсы с полными данными',estimateMae:'Средняя абсолютная ошибка',estimateMedian:'Медианная ошибка',estimateWithin5:'В пределах ±5 мин',estimateWithin15:'В пределах ±15 мин',estimateRevisions:'Корректировки расчётного времени',estimateByAirline:'Ошибка расчётного времени по авиакомпаниям',dailyTrend:'Динамика по дням',analysisInsights:'ВЫВОДЫ',analysisWhatMatters:'Что выделяется',insightDirectionOtp:'У {side} OTP15 ниже на {diff} п.п.',insightRouteDelay:'На направлении {route}: {late}/{total} рейсов задержаны >15 мин, OTP15 {otp}%.',insightTimeDelay:'В интервале {time}: {late} рейсов задержаны >15 мин, OTP15 {otp}%.',insightChanges:'У {flights} рейсов были операционные изменения: выход {gate}, стойка {checkin}, лента {belt}, время {time}.',insightEstimate:'Средняя ошибка последнего расчётного времени относительно фактического составляет {minutes} мин по {n} рейсам.',insightInsufficient:'Недостаточно фактических данных для надёжного вывода по этому фильтру.',routePunctuality:'Пунктуальность по маршрутам',timePunctuality:'Пунктуальность по времени',airlinePunctuality:'Пунктуальность по авиакомпаниям',
      airlinePerfTitle:'Пунктуальность / задержки по авиакомпаниям',allAirlinesDay:'Все авиакомпании сегодня',arrivalsPqc:'Прибытия на Фукуок',departuresPqc:'Вылеты с Фукуока',airlineCol:'Авиакомпания',totalCol:'Всего',completedCol:'Выполнено',onTimeCol:'Вовремя',late15Col:'Задержка >15 мин',avgDelayCol:'Средняя задержка',noFlightsDay:'Сегодня рейсов нет.',noCompleted:'Выполненных рейсов пока нет',onTimeSample:'{on}/{total} вовремя',minuteUnit:'мин',
      noFlights:'Нет рейсов по выбранным фильтрам.',noNextArrivals:'Нет ближайших прибытий в текущих данных.',ssArrivals:'ПРИБЫТИЯ',ssDepartures:'ВЫЛЕТЫ',ssNoFlights:'Нет рейсов',ssCancelled:'Отменён',ssArrived:'Прибыл',ssDelayed:'Задержка / перенос',ssEnRoute:'В пути на Фукуок',ssAwaitArr:'Ожидается подтверждение прибытия',ssSchedArr:'По расписанию · ещё не прибыл',ssDeparted:'Вылетел',ssServing:'Обслуживание в аэропорту',ssCheckinSoon:'Регистрация скоро откроется',ssAwaitDep:'Ожидается подтверждение вылета',ssSchedDep:'По расписанию · ещё не вылетел'
    },
    zh:{
      today:'今日富国岛机场',heroSub:'3秒了解机场运行情况。',total:'航班总数',arrivals:'到达',departures:'出发',intlArrivals:'国际到达',
      flightBoard:'今日航班',search:'查找航班',arrival:'到达',departure:'出发',all:'全部',next3:'未来3小时',international:'国际',domestic:'国内',changed:'有变更',showMore:'查看更多',
      searchPh:'搜索航班、航空公司或城市：VJ339、Hanoi、Da Nang...',opsWatch:'Operation Watch',quickSubtitle:'快速提醒',scheduleWord:'计划',nextArrivals:'即将到达',dataHealth:'数据状态',
      live:'实时',history:'历史',analytics:'分析',flights:'航班',refresh:'刷新',
      yesterday:'昨天',todayShort:'今天',tomorrow:'明天',yesterdayAt:'昨天的富国岛机场',tomorrowAt:'明天的富国岛机场',flightsYesterday:'昨天的航班',flightsTomorrow:'明天的航班',board:'航班表',boardYesterday:'昨天航班表',boardTomorrow:'明天航班表',boardUpdated:'航班表 {date} · 获取于 {time}',
      healthPillGood:'正常 · 数据最新',healthPillWatch:'注意 · 数据延迟',healthPillStale:'数据已过期',sourceLive:'JoTrip Live · 自动刷新',dataSync:'正在同步数据...',healthCheckingDesc:'正在检查JoTrip Live数据流和数据时效。',
      fidsTitle:'航班信息显示',fidsDesc:'计划、预计/实际时间、状态、登机口、值机柜台和行李转盘。',
      sched:'计划',estActual:'预计 / 实际',flight:'航班',route:'航线',status:'状态',gate:'登机口',counterBelt:'值机柜台 / 行李转盘',change:'变更',
      counter:'值机柜台',belt:'行李转盘',arr:'到达',dep:'出发',intl:'国际',dom:'国内',actual:'实际',est:'预计',schedShort:'计划',changedNow:'已变更',
      stable:'FIDS 正常',changesActive:'当前 {n} 项变更',noFidsChanges:'目前没有登机口、值机柜台或行李转盘变更。',noFidsFlights:'FIDS 暂无即将起飞或到达的航班。',
      sourceAirport:'依据机场数据更新',sourceAt:'数据 {time}',onTime:'准点',checkinOpen:'正在值机',checkinClosed:'值机已关闭',checkinSoon:'即将开始值机',checkinFrom:'{time}起办理值机',gateClosed:'登机口已关闭',ferryFlight:'调机航班',
      boarding:'正在登机',arrived:'已到达',departed:'已起飞',cancelled:'取消',flyingToPqc:'飞往富国岛途中',waitArrival:'等待到达时间',waitDeparture:'等待起飞时间',
      early:'预计提前 {n} 分钟',late:'延误 {n} 分钟',lateMin:'延误至少 {n} 分钟',earlyBy:'提前 {n} 分钟',lateBy:'延后 {n} 分钟',
      changeGate:'登机口：{from} → {to}',changedFrom:'原为：{from}',changeCounter:'值机：{from} → {to}',changeBelt:'行李：{from} → {to}',previousFrom:'原为：{from}',watchChangeGate:'当前登机口 {to} · 原为 {from}',watchChangeCounter:'当前值机柜台 {to} · 原为 {from}',watchChangeBelt:'当前行李转盘 {to} · 原为 {from}',
      watchDelayed:'延误',watchCancelled:'取消',watchEarly:'提前',watchClear:'今天没有明显延误、取消或提前的航班。',estimatedWord:'预计',quickClear:'目前没有需要立即注意的提醒。',quickDataOld:'数据已过期',quickDataOldBody:'实时数据更新延迟。使用信息前请先检查更新时间。',minutesAgo:'{n}分钟',noEstimate:'暂无预计时间',estimatedTime:'预计 {time}',toPqc:'到达PQC',fromPqc:'从PQC出发',pctArrivals:'到达 {pct}',pctDepartures:'出发 {pct}',flightUnit:'航班',unknownAirline:'航空公司未知',delayMinimum:'截至更新时间至少延误 {n} 分钟',delayReported:'已报告延误，暂未确定延误分钟数',airportNotPublished:'机场尚未公布时间',notApplicable:'不适用',airlinePerformanceKicker:'航空公司运行表现',arrivalsKicker:'到达',departuresKicker:'出发',onTimeShort:'准点 ≤15分钟',otpNote:'OTP15采用15分钟阈值，仅统计已执行航班。',fidsSync:'同步中',fidsSyncData:'正在同步FIDS...',fallbackError:'实时数据暂时中断 - 正在使用最新的JoTrip AutoSync快照。',loadError:'目前无法读取航班数据，不会把旧数据当作实时数据展示。',healthLostTitle:'数据不可用',healthLostDesc:'无法加载实时数据或备用快照。',healthQaFailTitle:'QA失败',healthQaFailDesc:'数据采集或标准化未通过QA，请勿用于运营判断。',
      market:'类型',scheduleCompare:'相对计划',checkinCounter:'值机柜台',checkinTime:'值机开始',boardingGate:'登机口',baggageBelt:'行李转盘',parking:'停机位',source:'来源',trackFlight:'航班追踪',openFr24:'在 FR24 搜索 ↗',
      scheduledAt:'计划 · {time}',actualAt:'实际 · {time}',estimatedAt:'预计 · {time}',rawStatus:'机场原始状态：',statusSource:'状态来自机场数据。',actualDesc:'实际时间已记录在航班数据中。',estimateDesc:'更新时间来自航班数据。',
      noEstimateDesc:'当前来源仅报告延误，尚未公布预计时间，JoTrip 不自行猜测。',noDelay:'准点 / 暂无时间偏差',unknown:'未知',
      updated:'更新于 {time} · {age} 分钟前 · {source} · 每分钟刷新',opsNormal:'运行正常',opsWatchCount:'WATCH · {n} 项',dataStale:'数据已过期',
      healthGoodTitle:'正常 · 数据最新',healthGoodDesc:'JoTrip Live 正在自动更新，并使用短缓存保持稳定。',healthWatchTitle:'注意 · 数据延迟',healthWatchDesc:'数据比平时更慢，页面每分钟重新检查。',
      healthStaleTitle:'数据已过期',healthStaleDesc:'数据已超过15分钟，不应视为实时状态。',healthFallbackTitle:'备用 · AUTOSYNC',healthFallbackDesc:'实时数据暂时无响应，页面正在使用最近保存的数据。',
      analyticsTitle:'航班结构',currentData:'当前数据',routeDistribution:'全部出发地 / 目的地',timeDistribution:'按时间分布',flightStatus:'航班状态',dataAge:'数据时效',analyticsExplorerTitle:'航班分析',analyticsExplorerDesc:'选择时间范围和分析类型。',analyticsLast7:'最近7天',analyticsLast30:'最近30天',analyticsLast7Short:'7天',analyticsLast30Short:'30天',analyticsCustom:'自定义',analyticsAnalysis:'分析',analyticsOverview:'概览',analyticsRoutes:'航线',analyticsTime:'时段',analyticsMarket:'市场',analyticsAirlines:'航空公司',analyticsOtp:'准点 OTP15',direction:'方向',fromDate:'开始日期',toDate:'结束日期',apply:'应用',allAirlines:'全部航空公司',analyticsAirlinesCount:'航空公司',analyticsAirlineVolume:'按航空公司统计航班',analyticsMarketMix:'市场结构',analyticsLoading:'正在加载分析数据...',analyticsLoadingShort:'加载中...',analyticsDataLabel:'{period} · {n} 航班',analyticsNoData:'没有符合条件的数据。',analyticsNoDataRange:'所选时间范围内没有数据。',analyticsLoadError:'目前无法加载分析数据。',notEnoughActual:'实际时间数据不足，无法计算准点率。',analyticsDelay:'延误分析',analyticsChanges:'运行变更',analyticsEstimate:'预计 vs 实际',otp15Label:'OTP15',delayOver30:'延误 >30分钟',delayOver60:'延误 >60分钟',medianDelay:'偏差中位数',p90Delay:'P90延误',analyticsGroup:'分组',delayByRoute:'按航线分析延误',delayByTime:'按时段分析延误',delayByAirline:'按航空公司分析延误',affectedFlights:'发生变更的航班',gateChanges:'登机口变更',checkinChanges:'值机柜台变更',beltChanges:'行李转盘变更',timeChanges:'时间变更',changesPerFlight:'每航班变更数',changesByAirline:'按航空公司统计变更',changesByRoute:'按航线统计变更',estimateSamples:'数据完整航班',estimateMae:'平均绝对误差',estimateMedian:'误差中位数',estimateWithin5:'±5分钟内',estimateWithin15:'±15分钟内',estimateRevisions:'预计时间修改次数',estimateByAirline:'按航空公司分析预计误差',dailyTrend:'每日趋势',analysisInsights:'分析结论',analysisWhatMatters:'值得注意',insightDirectionOtp:'{side} 的OTP15低 {diff} 个百分点。',insightRouteDelay:'{route} 有 {late}/{total} 班延误超过15分钟，OTP15为 {otp}%。',insightTimeDelay:'{time} 时段有 {late} 班延误超过15分钟，OTP15为 {otp}%。',insightChanges:'{flights} 班出现运行变更：登机口 {gate}，值机 {checkin}，行李转盘 {belt}，时间 {time}。',insightEstimate:'最终预计时间相对实际时间的平均误差为 {minutes} 分钟，共 {n} 班。',insightInsufficient:'当前筛选条件下实际数据不足，无法形成可靠分析。',routePunctuality:'按航线分析准点率',timePunctuality:'按时段分析准点率',airlinePunctuality:'按航空公司分析准点率',
      airlinePerfTitle:'航空公司准点 / 延误',allAirlinesDay:'今日全部航空公司',arrivalsPqc:'到达富国岛',departuresPqc:'从富国岛出发',airlineCol:'航空公司',totalCol:'总数',completedCol:'已执行',onTimeCol:'准点',late15Col:'延误 >15分钟',avgDelayCol:'平均延误',noFlightsDay:'今日暂无航班。',noCompleted:'暂无已执行航班',onTimeSample:'{on}/{total} 准点',minuteUnit:'分钟',
      noFlights:'当前筛选条件下没有航班。',noNextArrivals:'当前数据中没有即将到达的航班。',ssArrivals:'到达',ssDepartures:'出发',ssNoFlights:'暂无航班',ssCancelled:'取消',ssArrived:'已到达',ssDelayed:'延误 / 改时',ssEnRoute:'飞往富国岛途中',ssAwaitArr:'等待到达确认',ssSchedArr:'计划 · 尚未到达',ssDeparted:'已起飞',ssServing:'机场服务中',ssCheckinSoon:'即将开始值机',ssAwaitDep:'等待起飞确认',ssSchedDep:'计划 · 尚未起飞'
    }
  };

  function t(key,vars){
    let s=(D[lang]&&D[lang][key])||D.vi[key]||key;
    if(vars)Object.keys(vars).forEach(k=>{s=s.replace(new RegExp('\\{'+k+'\\}','g'),String(vars[k]));});
    return s;
  }
  window.JT_T=t;
  window.JT_LANG=()=>lang;

  function status(input){
    const s=String(input||'').trim();
    const folded=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toUpperCase();
    let m;
    if((m=s.match(/^Dự kiến sớm (\d+) phút$/i)))return t('early',{n:m[1]});
    if((m=s.match(/^Trễ ≥ (\d+) phút$/i)))return t('lateMin',{n:m[1]});
    if((m=s.match(/^Trễ (\d+) phút$/i)))return t('late',{n:m[1]});
    if((m=s.match(/^Đã hạ cánh\s*(?:·\s*)?(\d{1,2}:\d{2})(?:\s*·\s*(trễ|sớm)\s*(\d+)\s*phút)?$/i))){
      return t('arrived')+' '+m[1]+(m[2]?.toLowerCase()==='trễ'?' · '+t('late',{n:m[3]}):m[2]?.toLowerCase()==='sớm'?' · '+t('earlyBy',{n:m[3]}):'');
    }
    if((m=s.match(/^Đã cất cánh\s*(?:·\s*)?(\d{1,2}:\d{2})(?:\s*·\s*(trễ|sớm)\s*(\d+)\s*phút)?$/i))){
      return t('departed')+' '+m[1]+(m[2]?.toLowerCase()==='trễ'?' · '+t('late',{n:m[3]}):m[2]?.toLowerCase()==='sớm'?' · '+t('earlyBy',{n:m[3]}):'');
    }
    if((m=s.match(/^Check-in từ\s+(\d{1,2}:\d{2})$/i)))return t('checkinFrom',{time:m[1]});
    if((m=s.match(/^LÀM THỦ TỤC LÚC\s+(\d{1,2}:\d{2})$/i)))return t('checkinFrom',{time:m[1]});
    const exact={
      'Đúng giờ':'onTime','Đang check-in':'checkinOpen','Check-in đã đóng':'checkinClosed','Sắp mở check-in':'checkinSoon',
      'Đang lên máy bay':'boarding','Đã hạ cánh':'arrived','Đã cất cánh':'departed','Hủy':'cancelled',
      'Đang bay đến Phú Quốc':'flyingToPqc','Chờ giờ hạ cánh':'waitArrival','Chờ giờ cất cánh':'waitDeparture',
      'Chưa có giờ hạ cánh':'waitArrival','Chưa có giờ cất cánh':'waitDeparture',
      'Cửa khởi hành đã đóng':'gateClosed','Cửa ra máy bay đã đóng':'gateClosed','Chuyến bay ferry':'ferryFlight'
    };
    if(exact[s])return t(exact[s]);
    if(folded==='QUAY THU TUC DA DONG')return t('checkinClosed');
    if(folded==='CUA KHOI HANH DA DONG'||folded==='CUA RA MAY BAY DA DONG')return t('gateClosed');
    if(folded==='HANH KHACH DANG LEN TAU BAY'||folded==='DANG LEN MAY BAY')return t('boarding');
    if(folded==='DANG LAM THU TUC')return t('checkinOpen');
    if(folded==='CHUYEN BAY FERRY')return t('ferryFlight');
    if(folded==='DA HA CANH')return t('arrived');
    if(folded==='DA CAT CANH')return t('departed');
    if(folded==='DUNG GIO')return t('onTime');
    return s;
  }
  window.JT_STATUS=status;

  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];
  const set=(sel,value)=>{const el=typeof sel==='string'?q(sel):sel;if(el&&value!=null)el.textContent=value};
  const STATIONS={
    en:{'TP.HCM':'Ho Chi Minh City','HÀ NỘI':'Hanoi','ĐÀ NẴNG':'Da Nang','HẢI PHÒNG':'Hai Phong','CẦN THƠ':'Can Tho','CAM RANH':'Cam Ranh','INCHEON':'Incheon','SHANGHAI':'Shanghai',"XI'AN":"Xi'an"},
    ko:{'TP.HCM':'호찌민','HÀ NỘI':'하노이','ĐÀ NẴNG':'다낭','HẢI PHÒNG':'하이퐁','CẦN THƠ':'껀터','CAM RANH':'깜라인','INCHEON':'인천','SHANGHAI':'상하이',"XI'AN":'시안'},
    ru:{'TP.HCM':'Хошимин','HÀ NỘI':'Ханой','ĐÀ NẴNG':'Дананг','HẢI PHÒNG':'Хайфон','CẦN THƠ':'Кантхо','CAM RANH':'Камрань','INCHEON':'Инчхон','SHANGHAI':'Шанхай',"XI'AN":'Сиань'},
    zh:{'TP.HCM':'胡志明市','HÀ NỘI':'河内','ĐÀ NẴNG':'岘港','HẢI PHÒNG':'海防','CẦN THƠ':'芹苴','CAM RANH':'金兰','INCHEON':'仁川','SHANGHAI':'上海',"XI'AN":'西安'}
  };
  window.JT_STATION=function(value){return (STATIONS[lang]&&STATIONS[lang][value])||value};
  window.JT_LOCALE=function(){return lang==='vi'?'vi-VN':lang==='zh'?'zh-CN':lang==='ko'?'ko-KR':lang==='ru'?'ru-RU':'en-US'};

  function applyStatic(){
    document.documentElement.lang=lang==='zh'?'zh-CN':lang;
    const sel=q('#languageSelect');if(sel&&sel.value!==lang)sel.value=lang;

    const offset=(typeof state!=='undefined'&&Number.isFinite(Number(state.boardOffset)))?Number(state.boardOffset):0;
    set('.hero h2',offset<0?t('yesterdayAt'):offset>0?t('tomorrowAt'):t('today'));set('.hero p',t('heroSub'));
    const hs=qa('.hero-stats article span');[t('total'),t('arrivals'),t('departures'),t('intlArrivals')].forEach((v,i)=>{if(hs[i])hs[i].textContent=v;});
    const dayBtns=qa('.board-day-switch button');dayBtns.forEach(btn=>{const o=Number(btn.dataset.offset);btn.textContent=o<0?t('yesterday'):o>0?t('tomorrow'):t('todayShort');});

    set('#flightBoard .card-head h3',offset<0?t('flightsYesterday'):offset>0?t('flightsTomorrow'):t('flightBoard'));set('#searchToggle',t('search'));const inp=q('#flightSearch');if(inp)inp.placeholder=t('searchPh');
    const dirs=qa('#directionTabs button');[t('arrival'),t('departure'),t('all')].forEach((v,i)=>{if(dirs[i])dirs[i].textContent=v;});
    const chips=qa('#filterChips button');[t('all'),t('next3'),t('international'),t('domestic'),t('changed')].forEach((v,i)=>{if(chips[i])chips[i].textContent=v;});
    set('#showMore',t('showMore'));
    set('.source-label',t('sourceLive'));if(!state?.latest){set('#updatedAt',t('dataSync'));set('#healthDescription',t('healthCheckingDesc'));}
    set('#fidsBoard .fids-head h3',t('fidsTitle'));set('#fidsBoard .fids-head p',t('fidsDesc'));
    const fidsTabs=qa('#fidsDirectionTabs button');[t('departure'),t('arrival'),t('all')].forEach((v,i)=>{if(fidsTabs[i])fidsTabs[i].textContent=v;});
    const fidsCols=qa('#fidsBoard .fids-columns span');[t('sched'),t('estActual'),t('flight'),t('route'),t('status'),t('gate'),t('counterBelt'),t('change')].forEach((v,i)=>{if(fidsCols[i])fidsCols[i].textContent=v;});
    const fidsFoot=qa('#fidsBoard .fids-foot span');if(fidsFoot[0])fidsFoot[0].textContent=t('sourceAirport');
    const fidsState=q('#fidsBoardStatus');if(fidsState&&(!state?.latest||/Đang đồng bộ|Syncing|동기화|Синхронизация|同步/.test(fidsState.textContent)))fidsState.textContent=t('fidsSync');
    const fidsEmpty=q('#fidsGrid .empty-state');if(fidsEmpty&&/Đang đồng bộ FIDS|Syncing FIDS|FIDS 동기화|Синхронизация FIDS|正在同步FIDS/.test(fidsEmpty.textContent))fidsEmpty.textContent=t('fidsSyncData');

    qa('.operation-watch-title').forEach(el=>el.textContent=t('opsWatch'));qa('.operation-watch-subtitle').forEach(el=>el.textContent=t('quickSubtitle'));set('#dataHealthCard .side-head h3',t('dataHealth'));
    const modes=qa('.mode-switch button');if(modes[0])modes[0].textContent=t('live');if(modes[1])modes[1].textContent=t('history');if(modes[2])modes[2].textContent=t('analytics');
    const mobileFlights=q('#mobileFlights'),mobileRefresh=q('#mobileRefresh');if(mobileFlights&&mobileFlights.lastChild)mobileFlights.lastChild.nodeValue=t('flights');if(mobileRefresh&&mobileRefresh.lastChild)mobileRefresh.lastChild.nodeValue=t('refresh');

    if(typeof window.JT_ANALYTICS_RENDER==='function')window.JT_ANALYTICS_RENDER();
    const dts=qa('.health-meta dt');if(dts[3])dts[3].textContent=t('dataAge');
  }

  function applySummary(){
    if(typeof state==='undefined'||!state.latest)return;
    const l=state.latest,age=typeof ageInfo==='function'?ageInfo(l.collected_at_vn):{minutes:0,level:'good'};
    const src=state.dataSource==='live'?'JoTrip Live':state.dataSource==='fallback'?'AutoSync fallback':'JoTrip AutoSync';
    try{
      const time=new Date(l.collected_at_vn).toLocaleTimeString(lang==='vi'?'vi-VN':lang==='zh'?'zh-CN':lang,{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
      set('#updatedAt',t('updated',{time:time,age:age.minutes??0,source:src}));
    }catch(_){}
    const abnormal=typeof buildOperationWatchItems==='function'?buildOperationWatchItems().filter(x=>x.kind!=='data').length:(l.records||[]).filter(r=>!isPastRecord(r)&&(isAbnormal(r)||isEarly(r,10))).length;
    const ops=q('#opsState');
    if(ops){
      if(age.level==='stale'||age.level==='bad')ops.textContent=t('dataStale');
      else if(abnormal>0||age.level==='watch')ops.textContent=t('opsWatchCount',{n:abnormal});
      else ops.textContent=t('opsNormal');
    }
  }

  function applyHealth(){
    if(typeof state==='undefined'||!state.latest)return;
    const l=state.latest,h=state.health,age=ageInfo(l.collected_at_vn);
    const pass=!!(h?.collector_completed&&h?.parser_passed&&h?.normalization_passed&&h?.qa_passed&&l?.quality?.usable);
    const hp=q('#healthPill'),sl=q('.source-label');
    if(sl)sl.textContent=t('sourceLive');set('#dataAge',age.minutes==null?t('unknown'):t('minutesAgo',{n:age.minutes}));
    if(!pass){if(hp)hp.textContent='QA FAIL';set('#healthTitle',t('healthQaFailTitle'));set('#healthDescription',t('healthQaFailDesc'));return;}
    if(age.level==='good'){if(hp)hp.textContent=t('healthPillGood');}
    else if(age.level==='watch'){if(hp)hp.textContent=t('healthPillWatch');}
    else{if(hp)hp.textContent=t('healthPillStale');}
    if(state.dataSource==='fallback'){set('#healthTitle',t('healthFallbackTitle'));set('#healthDescription',t('healthFallbackDesc'));}
    else if(age.level==='good'){set('#healthTitle',t('healthGoodTitle'));set('#healthDescription',t('healthGoodDesc'));}
    else if(age.level==='watch'){set('#healthTitle',t('healthWatchTitle'));set('#healthDescription',t('healthWatchDesc'));}
    else{set('#healthTitle',t('healthStaleTitle'));set('#healthDescription',t('healthStaleDesc'));}
  }

  function applyFlights(){const empty=q('#flightList .empty-state');if(empty)empty.textContent=t('noFlights');}
  function applyNextArrivals(){
    qa('#nextArrivalsList .arrival-item').forEach(row=>{
      const sub=row.querySelector('.arrival-main span'),pill=row.querySelector('.status-pill');
      if(sub){const m=sub.textContent.trim().match(/^Dự kiến\s+(\d{1,2}:\d{2})$/);if(m)sub.textContent=t('est')+' '+m[1];}
      if(pill)pill.textContent=status(pill.textContent.trim());
    });
    const empty=q('#nextArrivalsList .empty-state');if(empty)empty.textContent=t('noNextArrivals');
  }

  function applyAnalytics(){if(typeof window.JT_ANALYTICS_RENDER==='function')window.JT_ANALYTICS_RENDER();}
  function applyDrawer(){}
  function applyError(){
    const box=q('#errorBox');if(!box||box.classList.contains('hidden'))return;
    if(state?.dataSource==='fallback')box.textContent=t('fallbackError');else if(state?.liveError)box.textContent=t('loadError');
  }
  function apply(){
    applyStatic();applySummary();applyHealth();applyFlights();applyNextArrivals();applyAnalytics();applyDrawer();applyError();
  }

  function wrap(name,after){
    const fn=window[name];if(typeof fn!=='function'||fn.__jtLang)return;
    const w=function(){const out=fn.apply(this,arguments);if(after)after();else apply();return out;};
    w.__jtLang=true;window[name]=w;
  }

  wrap('renderSummary',()=>{applyStatic();applySummary();});
  wrap('renderHealth',applyHealth);
  wrap('renderFlights',applyFlights);
  wrap('renderWatch',applyStatic);
  wrap('renderNextArrivals',applyNextArrivals);
  wrap('renderAnalytics',()=>{applyStatic();applyAnalytics();});

  if(typeof window.openDrawer==='function'){
    const base=window.openDrawer;window.openDrawer=function(){const out=base.apply(this,arguments);applyDrawer();return out;};
  }

  if(typeof window.displayStatusLabel==='function'){
    const base=window.displayStatusLabel;window.displayStatusLabel=function(r){return status(base(r));};
  }
  if(typeof window.delayStatusLabel==='function'){
    const base=window.delayStatusLabel;window.delayStatusLabel=function(r){return status(base(r));};
  }
  if(typeof window.statusClass==='function'){
    const base=window.statusClass;window.statusClass=function(value){
      const cls=base(value);if(cls&&cls!=='gray')return cls;
      const s=String(value||'');
      if([D.en.cancelled,D.ko.cancelled,D.ru.cancelled,D.zh.cancelled].some(x=>s.includes(x)))return'red';
      if(/delay|late|early|지연|조기|задерж|раньше|延误|提前/i.test(s))return'amber';
      if([D.en.arrived,D.ko.arrived,D.ru.arrived,D.zh.arrived,D.en.departed,D.ko.departed,D.ru.departed,D.zh.departed].some(x=>s.includes(x)))return'green';
      if([D.en.onTime,D.ko.onTime,D.ru.onTime,D.zh.onTime,D.en.checkinOpen,D.ko.checkinOpen,D.ru.checkinOpen,D.zh.checkinOpen,D.en.boarding,D.ko.boarding,D.ru.boarding,D.zh.boarding].some(x=>s.includes(x)))return'blue';
      return cls||'gray';
    };
  }

  window.JT_SET_LANG=function(next){
    if(!LANGS.includes(next))return;
    lang=next;try{localStorage.setItem('jotrip_airport_lang',lang)}catch(_){}
    if(typeof window.renderAll==='function')window.renderAll();
    if(typeof window.JT_RENDER_FIDS==='function')window.JT_RENDER_FIDS(true);
    if(typeof window.renderWatch==='function')window.renderWatch();
    apply();
  };

  const select=q('#languageSelect');if(select){select.value=lang;select.addEventListener('change',()=>window.JT_SET_LANG(select.value));}
  if(typeof state!=='undefined'&&state?.latest&&typeof window.renderAll==='function')window.renderAll();
  apply();
})();
