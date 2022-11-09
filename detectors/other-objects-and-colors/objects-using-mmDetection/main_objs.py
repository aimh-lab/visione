import argparse
import os
from util.utilFiles import*
from util.utils_MongoDB import *
import object_extractor
import torch

DEFAULT_FOLDER = {
    'V3C1': "Z:/VBS/V3C_dataset/V3C1",
    'V3C2': "Z:/VBS/V3C_dataset/V3C2",
    'MarineVideoKit': "F:/Datasets/MarineVideoKit",
}

IMAGE_FOLDERNAME={
    'V3C1': 'V3C1/keyframes_VISIONE',
    'V3C2': 'V3C2/keyframes_VISIONE',
    'MarineVideoKit': 'selected_frames'
}




def main(args):
    args_dic=vars(args)

    datadir=args_dic.get('datadir',DEFAULT_FOLDER[args.dataset])
    image_folder=f"{datadir}/{IMAGE_FOLDERNAME[args.dataset]}"

    out_Folder=f"{args_dic.get('output_folder',datadir)}"
    os.makedirs(out_Folder, exist_ok=True)

    list_images_FN=f"{out_Folder}/{args.dataset}_listFn.txt"


    if os.path.isfile(list_images_FN):
        with open(list_images_FN, 'r') as f:
            filenames=[line.strip() for line in f]
        count = len(filenames)
        print(f"read {count} files")
    else:
        count, filenames = get_filenames(image_folder, 0, [])
        with open(list_images_FN,'w') as f:
            for item in filenames:
                f.write(f"{item}\n")

    name_nn=args.model
    out_Folder = f'{out_Folder}/Objects/{name_nn}'
    out_FN = f'{out_Folder}/{args.dataset}_{name_nn}.txt'
    if args.doAnnotation:
        os.makedirs(out_Folder, exist_ok=True)
        out_NOT_processed_FN,out_processed_FN=object_extractor.run(name_nn,args.device,out_FN,list_images_FN, args.conf_threshold)
        if(args.device!='cpu'):
            #trying using cpu
            print("Trying using CPU")
            out_NOT_processed_FN,out_processed_FN = object_extractor.run(name_nn, 'cpu', out_FN, out_NOT_processed_FN, args.conf_threshold)

        with open(out_processed_FN, 'r') as fp:
            x = len(fp.readlines())
            print('Total images processed:', x)  # 8
        with open(out_NOT_processed_FN, 'r') as fp:
            x = len(fp.readlines())
            print('Total images *NOT* processed:', x)  # 8

    if args_dic.get('saveMongoDB', True):
        collection_name = name_nn
        annotation_FN =out_FN
        save_in_mongo(annotation_FN, (args.dataset).lower(), collection_name,'objects',args.mongo_configfile)





# Press the green button in the gutter to run the script.
if __name__ == '__main__':
    parser = argparse.ArgumentParser( description='Extract Object Annotation',argument_default=argparse.SUPPRESS,formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    parser.add_argument('--doAnnotation', action='store_true', help='To annotate')
    parser.set_defaults(doAnnotation=False)  #
    parser.add_argument('-d', '--dataset', choices=['V3C1','V3C2','MarineVideoKit'], default= 'MarineVideoKit',
                        help='Name of the dataset.')  #
    parser.add_argument( '--model', choices=['faster_rcnn','mask_rcnn_lvis', 'vfnet_X-101-32x4d','vfnet_X-101-64x4d'], default= 'vfnet_X-101-32x4d',
                        help='Name of the dataset.')  #

    parser.add_argument('--datadir', type=str, help='Path of the dir containing the dataset (main folder). If not setted the default V3C1,V3C2, or MarineVideoKit folder will be used')
    parser.add_argument('--output_folder',
                        help='output folder. If not setted a Objects folder will be created in the datadir')

    parser.add_argument('--saveMongoDB', action='store_true', help='To annotate')
    parser.set_defaults(saveMongoDB=False)
    parser.add_argument('--mongo_configfile', default='../visione_MongoDBConfig.yaml',
                        help='yaml file with host, username and password of MongoDB')

    parser.add_argument('-conf_threshold', type=float, default=0.3, help='th_dominant')
    parser.add_argument('--no-gpu', action='store_false', dest='cuda',
                        help='Run with CPU (if not specified GPU is used).')
    parser.set_defaults(cuda=True)  #

    args = parser.parse_args()
    args.device = 'cpu' #torch.device('cpu')
    if (args.cuda) and torch.cuda.is_available():
        args.device = 'cuda:0'# torch.device('cuda') #

    print(args)
    main(args)


