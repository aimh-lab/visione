class Config:
    def __init__(self,
        video_path=None,
        checkpoint='checkpoints',
        clip_path='clip_models/ViT-B-32.pt'):

        self.do_eval = True
        self.video_path = video_path
        self.data_path = 'data/msrvtt_data/MSRVTT_data.json'
        self.features_path = None
        self.num_thread_reader = 0
        # self.batch_size_val = 64
        self.seed = 42
        self.max_words = 32
        self.max_frames = 36
        self.feature_framerate = 2
        self.output_dir = None
        self.cross_model = 'cross-base'
        self.do_lower_case = True
        self.n_gpu = 1
        self.cache_dir = ''
        self.fp16 = True
        self.fp16_opt_level = 'O1'
        self.cross_num_hidden_layers = 4
        self.sim_type = 'seqTransf'
        self.checkpoint = checkpoint
        self.model_num = 2
        self.local_rank = 0
        self.datatype = 'msrvtt'
        self.vocab_size = 49408
        self.temporal_type = 'TDB'
        self.temporal_proj = 'sigmoid_selfA'
        self.center_type = ''
        self.centerK = 5
        self.center_weight = 0.5
        self.center_proj = 'TAB_TDB'
        self.clip_path = clip_path
        self.gpu = True